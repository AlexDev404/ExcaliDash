import { Download, Paperclip, Send, X } from 'lucide-react';
import React, {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ChatAttachment, ChatMessage } from './ChatTypes';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

interface Peer {
  id: string;
  name: string;
  color: string;
}

interface ChatThreadViewProps {
  threadId: string;
  messages: ChatMessage[];
  peers: Peer[];
  myId: string;
  onSend: (body: string, attachments: ChatAttachment[], mentionedUserIds: string[]) => void;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox: React.FC<{ src: string; name: string; onClose: () => void }> = ({ src, name, onClose }) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
      onClick={e => e.stopPropagation()}
    >
      <img
        src={src}
        alt={name}
        className="max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl object-contain"
      />
      <div className="flex items-center gap-2">
        <a
          href={src}
          download={name}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors border border-white/20"
          onClick={e => e.stopPropagation()}
        >
          <Download size={15} />
          Download
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  </div>
);

// ─── Mention parsing ──────────────────────────────────────────────────────────
const renderBody = (body: string): React.ReactNode[] => {
  const parts = body.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-indigo-600 dark:text-indigo-400 font-semibold">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

// ─── Message bubble ───────────────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: ChatMessage; isMine: boolean }> = ({ message, isMine }) => {
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
      {lightbox && (
        <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
      {!isMine && (
        <span className="text-[10px] font-semibold px-1" style={{ color: message.authorColor }}>
          {message.authorName}
        </span>
      )}
      <div
        className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm break-words ${
          isMine
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 rounded-bl-sm'
        }`}
      >
        {message.body && <p className="whitespace-pre-wrap leading-relaxed">{renderBody(message.body)}</p>}
        {message.attachments.map((att, idx) =>
          att.mimeType.startsWith('image/') ? (
            <button
              key={idx}
              type="button"
              onClick={() => setLightbox({ src: att.dataURL, name: att.name })}
              className="mt-1.5 block focus:outline-none group/img"
              title="Click to expand"
            >
              <img
                src={att.dataURL}
                alt={att.name}
                className="max-w-[200px] rounded-lg border border-black/10 group-hover/img:opacity-90 transition-opacity cursor-zoom-in"
              />
            </button>
          ) : (
            <a
              key={idx}
              href={att.dataURL}
              download={att.name}
              className={`mt-1.5 flex items-center gap-1.5 text-xs underline ${isMine ? 'text-white/80' : 'text-indigo-600 dark:text-indigo-400'}`}
            >
              <Paperclip size={12} />
              {att.name} ({(att.size / 1024).toFixed(1)} KB)
            </a>
          )
        )}
      </div>
      <span className="text-[9px] text-slate-400 dark:text-neutral-500 px-1">{time}</span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const ChatThreadView: React.FC<ChatThreadViewProps> = ({
  messages,
  peers,
  myId,
  onSend,
}) => {
  const [body, setBody] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Detect @mention trigger as user types
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);

    // Find the last @ before the cursor
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && !before.slice(atIdx + 1).includes(' ')) {
      setMentionQuery(before.slice(atIdx + 1));
      setMentionStart(atIdx);
    } else {
      setMentionQuery(null);
    }
  }, []);

  const selectMention = useCallback((peer: Peer) => {
    const cursor = inputRef.current?.selectionStart ?? body.length;
    const before = body.slice(0, mentionStart) + `@${peer.name} `;
    const after = body.slice(cursor);
    setBody(before + after);
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }, [body, mentionStart]);

  // Extract mentioned user IDs from the body string at send time
  const extractMentions = useCallback((text: string): string[] => {
    const tokens = text.match(/@(\S+)/g)?.map(t => t.slice(1)) ?? [];
    return peers
      .filter(p => tokens.includes(p.name))
      .map(p => p.id);
  }, [peers]);

  const handleSend = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    const mentioned = extractMentions(trimmed);
    onSend(trimmed, pendingAttachments, mentioned);
    setBody('');
    setPendingAttachments([]);
    setMentionQuery(null);
  }, [body, pendingAttachments, extractMentions, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Attachment file read
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const results: ChatAttachment[] = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        alert(`"${file.name}" is too large (max 5 MB).`);
        continue;
      }
      const dataURL = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      results.push({ name: file.name, mimeType: file.type || 'application/octet-stream', dataURL, size: file.size });
    }
    setPendingAttachments(prev => [...prev, ...results]);
  }, []);

  const filteredPeers = mentionQuery !== null
    ? peers.filter(
        p => p.id !== myId && p.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-400 dark:text-neutral-500 pt-6">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} isMine={msg.authorId === myId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Pending attachments preview */}
      {pendingAttachments.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-slate-200 dark:border-neutral-700">
          {pendingAttachments.map((att, idx) => (
            <div key={idx} className="relative group">
              {att.mimeType.startsWith('image/') ? (
                <img
                  src={att.dataURL}
                  alt={att.name}
                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-neutral-700"
                />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center bg-slate-100 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 text-[9px] text-slate-500 font-semibold text-center px-1 break-all">
                  {att.name.slice(-12)}
                </div>
              )}
              <button
                onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* @mention dropdown */}
      {filteredPeers.length > 0 && (
        <div className="mx-3 mb-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden">
          {filteredPeers.slice(0, 6).map(peer => (
            <button
              key={peer.id}
              onMouseDown={(e) => { e.preventDefault(); selectMention(peer); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b last:border-b-0 border-slate-100 dark:border-neutral-800"
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-neutral-100">{peer.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-200 dark:border-neutral-700 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={body}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Message… (Shift+Enter for new line)"
          className="flex-1 resize-none text-sm px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 outline-none focus:border-indigo-400 transition-colors min-h-[38px] max-h-[120px] leading-relaxed"
          style={{ height: Math.min(120, Math.max(38, body.split('\n').length * 22)) }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.txt,.csv,.md,.json"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800"
          title="Attach file (max 5 MB)"
        >
          <Paperclip size={16} />
        </button>
        <button
          onClick={handleSend}
          disabled={!body.trim() && pendingAttachments.length === 0}
          className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
