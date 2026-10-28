"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import SignOutButton from "./SignOutButton";

interface Chat {
  id: string;
  title: string;
  updatedAt: string | Date;
}

interface ChatSidebarProps {
  chats: Chat[];
  userName?: string | null;
  userImage?: string | null;
}

export default function ChatSidebar({ chats, userName, userImage }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleDeleteChat(e: React.MouseEvent, chatId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Xóa cuộc trò chuyện này?")) return;
    setDeleting(chatId);
    try {
      await fetch(`/api/chat/${chatId}`, { method: "DELETE" });
      if (pathname === `/chat/${chatId}`) {
        router.push("/chat");
      } else {
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  const sidebarContent = (
    <aside className="w-64 bg-gray-900 text-gray-100 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <Link
          href="/chat"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium flex-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" className="w-5 h-5 flex-shrink-0">
            <defs>
              <linearGradient id="sl1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="50%" stopColor="#8b5cf6"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="22" fill="url(#sl1)"/>
            <path d="M50 18 C50 18 54 38 62 46 C70 54 82 50 82 50 C82 50 70 54 62 62 C54 70 50 82 50 82 C50 82 46 70 38 62 C30 54 18 50 18 50 C18 50 30 46 38 38 C46 30 50 18 50 18Z" fill="white" opacity="0.95"/>
            <path d="M76 24 C76 24 77.5 30 80 32.5 C82.5 35 88 34 88 34 C88 34 82.5 35 80 37.5 C77.5 40 76 46 76 46 C76 46 74.5 40 72 37.5 C69.5 35 64 34 64 34 C64 34 69.5 35 72 32.5 C74.5 30 76 24 76 24Z" fill="white" opacity="0.7"/>
          </svg>
          <span>Cuộc trò chuyện mới</span>
        </Link>
        {/* Close button — mobile only */}
        <button
          onClick={() => setIsOpen(false)}
          className="ml-2 md:hidden p-2 text-gray-400 hover:text-white rounded-lg"
          aria-label="Đóng sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chat list */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {chats.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">Chưa có cuộc trò chuyện nào</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center justify-between rounded-lg transition-colors ${
                pathname === `/chat/${chat.id}` ? "bg-gray-700" : "hover:bg-gray-800"
              }`}
            >
              <Link
                href={`/chat/${chat.id}`}
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2.5 text-sm text-gray-300 truncate"
              >
                {chat.title}
              </Link>
              <button
                onClick={(e) => handleDeleteChat(e, chat.id)}
                disabled={deleting === chat.id}
                className="flex-shrink-0 pr-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity text-xs"
                title="Xóa"
              >
                {deleting === chat.id ? "⏳" : "🗑"}
              </button>
            </div>
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700 space-y-1">
        <Link
          href="/documents"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span>📂</span>
          <span>Tài liệu của tôi</span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-2">
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userImage} alt={userName ?? ""} className="w-7 h-7 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {userName?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
          )}
          <span className="flex-1 text-sm text-gray-400 truncate min-w-0">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible md+ */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile: hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2.5 bg-gray-900 text-white rounded-lg shadow-lg"
        aria-label="Mở menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile: overlay backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile: slide-in sidebar */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
