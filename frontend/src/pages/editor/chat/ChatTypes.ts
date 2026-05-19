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
  /** Set on pinboard copies — the id of the thread the original message came from */
  pinnedFromThreadId?: string;
  /** Set on pinboard copies — the id of the original message */
  pinnedFromMessageId?: string;
}

export interface ChatThread {
  id: string;
  name: string;
  createdAt: number;
  isDefault: boolean; // true for "Main" and "Pinboard" — cannot be deleted
  isPinboard?: boolean;
}

/** Payload emitted / received over the socket */
export interface ChatMessagePayload {
  drawingId: string;
  threadId: string;
  message: ChatMessage;
}

/** Payload for pin / unpin events */
export interface ChatPinPayload {
  drawingId: string;
  message: ChatMessage; // the original message being pinned
}

export interface ChatUnpinPayload {
  drawingId: string;
  originalMessageId: string;
}
