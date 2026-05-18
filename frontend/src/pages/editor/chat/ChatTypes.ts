export interface ChatAttachment {
  name: string;
  mimeType: string;
  dataURL: string; // base64
  size: number;    // original bytes
}

export interface ChatMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  body: string;
  attachments: ChatAttachment[];
  mentionedUserIds: string[];
  timestamp: number;
  /** Optional: thread name — carried on the first message to a new thread so receivers can create it */
  threadName?: string;
}

export interface ChatThread {
  id: string;
  name: string;
  createdAt: number;
  isDefault: boolean; // true for "Main" — cannot be deleted
}

/** Payload emitted / received over the socket */
export interface ChatMessagePayload {
  drawingId: string;
  threadId: string;
  message: ChatMessage;
}
