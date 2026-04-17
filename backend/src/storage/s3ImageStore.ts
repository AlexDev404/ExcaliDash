import crypto from "crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type ExternalStorageRef = {
  provider: "s3";
  bucket: string;
  key: string;
  sha256: string;
  sizeBytes: number;
};

type DrawingFileRecord = {
  id?: string;
  dataURL?: string;
  mimeType?: string;
  created?: number;
  externalStorage?: ExternalStorageRef;
  [key: string]: unknown;
};

type S3ImageStoreConfig = {
  enabled: boolean;
  endpoint: string | null;
  region: string;
  bucket: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  forcePathStyle: boolean;
  keyPrefix: string;
};

const DATA_URL_RE = /^data:([^;,]+);base64,(.+)$/i;

const extByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
};

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:image/");

const parseDataUrl = (dataURL: string): { mimeType: string; buffer: Buffer } | null => {
  const match = DATA_URL_RE.exec(dataURL);
  if (!match) return null;
  const mimeType = match[1]?.toLowerCase() || "application/octet-stream";
  const base64Payload = match[2] || "";
  try {
    return {
      mimeType,
      buffer: Buffer.from(base64Payload, "base64"),
    };
  } catch {
    return null;
  }
};

const extFromMimeType = (mimeType: string): string =>
  extByMimeType[mimeType.toLowerCase()] || "bin";

const toDataUrl = (mimeType: string, body: Buffer): string =>
  `data:${mimeType};base64,${body.toString("base64")}`;

const bodyToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) return Buffer.alloc(0);
  const maybeBody = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };
  if (typeof maybeBody.transformToByteArray === "function") {
    const bytes = await maybeBody.transformToByteArray();
    return Buffer.from(bytes);
  }
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  const stream = body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer | Uint8Array | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return Buffer.concat(chunks);
};

const isExternalS3Ref = (value: unknown): value is ExternalStorageRef => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.provider === "s3" &&
    typeof v.bucket === "string" &&
    typeof v.key === "string" &&
    typeof v.sha256 === "string" &&
    typeof v.sizeBytes === "number"
  );
};

export class S3ImageStore {
  private readonly enabled: boolean;
  private readonly bucket: string | null;
  private readonly keyPrefix: string;
  private readonly s3: S3Client | null;

  constructor(cfg: S3ImageStoreConfig) {
    this.enabled = cfg.enabled;
    this.bucket = cfg.bucket;
    this.keyPrefix = cfg.keyPrefix;

    if (!cfg.enabled) {
      this.s3 = null;
      return;
    }

    this.s3 = new S3Client({
      endpoint: cfg.endpoint || undefined,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
            }
          : undefined,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private ensureReady(): { s3: S3Client; bucket: string } {
    if (!this.enabled || !this.s3 || !this.bucket) {
      throw new Error("S3 image storage is disabled or not configured");
    }
    return { s3: this.s3, bucket: this.bucket };
  }

  private buildObjectKey(sha256: string, mimeType: string): string {
    const ext = extFromMimeType(mimeType);
    const prefix = this.keyPrefix ? `${this.keyPrefix}/` : "";
    return `${prefix}${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}.${ext}`;
  }

  async externalizeFiles(
    files: Record<string, DrawingFileRecord> | null | undefined
  ): Promise<{ files: Record<string, DrawingFileRecord>; changed: boolean; changedCount: number }> {
    const input = files || {};
    if (!this.enabled) {
      return { files: input, changed: false, changedCount: 0 };
    }

    const { s3, bucket } = this.ensureReady();
    const entries = Object.entries(input);
    const next: Record<string, DrawingFileRecord> = { ...input };
    let changed = false;
    let changedCount = 0;

    for (const [fileId, fileRecord] of entries) {
      const dataURL = fileRecord?.dataURL;
      if (!isImageDataUrl(dataURL)) continue;

      const parsed = parseDataUrl(dataURL);
      if (!parsed) continue;

      const { mimeType, buffer } = parsed;
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      const key = this.buildObjectKey(sha256, mimeType);

      let exists = true;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      } catch {
        exists = false;
      }
      if (!exists) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            Metadata: {
              fileid: fileId,
              sha256,
            },
          })
        );
      }

      const { dataURL: _removed, ...rest } = fileRecord || {};
      next[fileId] = {
        ...rest,
        mimeType: mimeType || fileRecord?.mimeType,
        externalStorage: {
          provider: "s3",
          bucket,
          key,
          sha256,
          sizeBytes: buffer.byteLength,
        },
      };
      changed = true;
      changedCount += 1;
    }

    return {
      files: changed ? next : input,
      changed,
      changedCount,
    };
  }

  async loadExternalFileAsDataUrl(fileRecord: DrawingFileRecord): Promise<string | null> {
    if (!this.enabled || !this.s3) return null;
    if (!isExternalS3Ref(fileRecord?.externalStorage)) return null;

    const ref = fileRecord.externalStorage;
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: ref.bucket,
        Key: ref.key,
      })
    );
    const body = await bodyToBuffer(response.Body);
    const mimeType =
      typeof response.ContentType === "string" && response.ContentType.length > 0
        ? response.ContentType
        : typeof fileRecord.mimeType === "string"
        ? fileRecord.mimeType
        : "application/octet-stream";
    return toDataUrl(mimeType, body);
  }

  async getExternalFileBuffer(fileRecord: DrawingFileRecord): Promise<{
    body: Buffer;
    mimeType: string;
    etag?: string;
    sizeBytes: number;
  } | null> {
    if (!this.enabled || !this.s3) return null;
    if (!isExternalS3Ref(fileRecord?.externalStorage)) return null;

    const ref = fileRecord.externalStorage;
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: ref.bucket,
        Key: ref.key,
      })
    );
    const body = await bodyToBuffer(response.Body);
    const mimeType =
      typeof response.ContentType === "string" && response.ContentType.length > 0
        ? response.ContentType
        : typeof fileRecord.mimeType === "string"
        ? fileRecord.mimeType
        : "application/octet-stream";

    return {
      body,
      mimeType,
      etag: typeof response.ETag === "string" ? response.ETag : undefined,
      sizeBytes: body.byteLength,
    };
  }
}

export type { DrawingFileRecord, ExternalStorageRef };
