"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SourceRef {
  documentId: string;
  filename: string;
  chunkId: string;
  snippet: string;
  distance: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[] | null;
}

interface ChatWindowProps {
  chatId?: string;
  initialMessages?: Message[];
}

function MarkdownRenderer({ text }: { text: string }) {
  // Split thành các block theo double newline
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading #, ##, ###, ####
        const h4 = trimmed.match(/^####\s+(.+)/);
        if (h4) return <p key={i} className="font-semibold text-gray-800 text-sm mt-1">{h4[1]}</p>;

        const h3 = trimmed.match(/^###\s+(.+)/);
        if (h3) return <p key={i} className="font-bold text-gray-800 text-sm mt-2">{h3[1]}</p>;

        const h2 = trimmed.match(/^##\s+(.+)/);
        if (h2) return <p key={i} className="font-bold text-gray-900 text-base mt-2">{h2[1]}</p>;

        const h1 = trimmed.match(/^#\s+(.+)/);
        if (h1) return <p key={i} className="font-bold text-gray-900 text-base mt-2 uppercase tracking-wide">{h1[1]}</p>;

        // Horizontal rule ---
        if (/^---+$/.test(trimmed)) return <hr key={i} className="border-gray-300 my-1" />;

        // Bullet list
        const lines = trimmed.split("\n");
        const isList = lines.every((l) => /^\s*[\*\-]\s/.test(l) || l.trim() === "");
        if (isList) {
          return (
            <ul key={i} className="list-disc list-inside space-y-1 pl-1">
              {lines.filter(Boolean).map((l, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  <InlineMarkdown text={l.replace(/^\s*[\*\-]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        // Numbered list
        const isNumbered = lines.every((l) => /^\s*\d+\.\s/.test(l) || l.trim() === "");
        if (isNumbered) {
          return (
            <ol key={i} className="list-decimal list-inside space-y-1 pl-1">
              {lines.filter(Boolean).map((l, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  <InlineMarkdown text={l.replace(/^\s*\d+\.\s+/, "")} />
                </li>
              ))}
            </ol>
          );
        }

        // Code block ```
        const codeMatch = trimmed.match(/^```[\w]*\n?([\s\S]*?)```$/);
        if (codeMatch) {
          return (
            <pre key={i} className="bg-gray-800 text-green-300 text-xs rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
              {codeMatch[1].trim()}
            </pre>
          );
        }

        // Normal paragraph — có thể nhiều dòng
        return (
          <p key={i} className="text-sm leading-relaxed">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <InlineMarkdown text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Xử lý inline: **bold**, *italic*, `code`, _(italic)_
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|_[^_]+_)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*(.+)\*\*$/.test(part))
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (/^\*(.+)\*$/.test(part))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^`(.+)`$/.test(part))
          return <code key={i} className="bg-gray-200 text-gray-800 text-xs px-1 py-0.5 rounded font-mono">{part.slice(1, -1)}</code>;
        if (/^_(.+)_$/.test(part))
          return <em key={i} className="text-gray-500">{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function SourcesToggle({ sources }: { sources: SourceRef[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span>
          {open ? "Ẩn nguồn tham khảo" : `${sources.length} nguồn tham khảo`}
        </span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5">
          {sources.map((s, i) => (
            <div key={i} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-medium text-gray-600">📄 {s.filename}</span>
                <span className="text-gray-400">(score: {(1 - s.distance).toFixed(3)})</span>
              </div>
              <p className="text-gray-500 mt-1 line-clamp-2">{s.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatWindow({ chatId, initialMessages = [] }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Placeholder for assistant streaming
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", sources: null },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, chatId: currentChatId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ Lỗi: ${err.error ?? "Không xác định"}` }
              : m
          )
        );
        return;
      }

      // Read chatId from response header
      const newChatId = res.headers.get("X-Chat-Id");
      if (newChatId && !currentChatId) {
        setCurrentChatId(newChatId);
        router.replace(`/chat/${newChatId}`);
      }

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Check if it's the sources JSON at the end
          if (chunk.startsWith("\n\n__SOURCES__:")) {
            try {
              const sourcesJson = chunk.replace("\n\n__SOURCES__:", "").trim();
              const sources = JSON.parse(sourcesJson) as SourceRef[];
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
              );
            } catch {
              // ignore parse error
            }
          } else {
            fullText += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: fullText } : m
              )
            );
          }
        }
      }

      router.refresh();
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "❌ Lỗi kết nối tới server." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pt-16 md:pt-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Xin chào!</h2>
            <p className="text-sm max-w-sm">
              Hỏi tôi bất cứ điều gì về tài liệu bạn đã upload.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1">
                G
              </div>
            )}
            <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : msg.content ? (
                  <MarkdownRenderer text={msg.content} />
                ) : loading ? (
                  <span className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  </span>
                ) : null}
              </div>

              {/* Sources — collapsed by default */}
              {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                <SourcesToggle sources={msg.sources} />
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1">
                U
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus-within:border-blue-400 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi về tài liệu của bạn..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-400 max-h-48"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Nhấn Enter để gửi, Shift+Enter để xuống dòng
          </p>
        </div>
      </div>
    </div>
  );
}
