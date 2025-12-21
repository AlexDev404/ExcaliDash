import { exportToSvg } from "@excalidraw/excalidraw";
import { api } from "../api";

export const importDrawings = async (
  files: File[],
  targetCollectionId: string | null,
  onSuccess?: () => void | Promise<void>
) => {
  const drawingFiles = files.filter(
    (f) => f.name.endsWith(".json") || f.name.endsWith(".excalidraw")
  );

  if (drawingFiles.length === 0) {
    return { success: 0, failed: 0, errors: ["No supported files found."] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  await Promise.all(
    drawingFiles.map(async (file) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.elements || !data.appState) {
          throw new Error(`Invalid file structure: ${file.name}`);
        }

        const svg = await exportToSvg({
          elements: data.elements,
          appState: {
            ...data.appState,
            exportBackground: true,
            viewBackgroundColor: data.appState.viewBackgroundColor || "#ffffff",
          },
          files: data.files || {},
          exportPadding: 10,
        });

        const payload = {
          name: file.name.replace(/\.(json|excalidraw)$/, ""),
          elements: data.elements,
          appState: data.appState,
          files: data.files || null,
          collectionId: targetCollectionId,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          preview: svg.outerHTML,
        };

        await api.post("/drawings", payload, {
          headers: {
            // Backend uses this header to apply stricter validation for imported files.
            "X-Imported-File": "true",
          },
        });
        successCount++;
      } catch (err: any) {
        console.error(`Failed to import ${file.name}:`, err);
        failCount++;
        const apiMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "API Error";
        errors.push(`${file.name}: ${apiMessage}`);
      }
    })
  );

  if (successCount > 0 && onSuccess) {
    await onSuccess();
  }

  return { success: successCount, failed: failCount, errors };
};
