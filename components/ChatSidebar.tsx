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

  return (
    <aside className="w-64 bg-gray-900 text-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <Link
          href="/chat"
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
        >
          <span>✨</span>
          <span>Cuộc trò chuyện mới</span>
        </Link>
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
                pathname === `/chat/${chat.id}`
                  ? "bg-gray-700"
                  : "hover:bg-gray-800"
              }`}
            >
              <Link
                href={`/chat/${chat.id}`}
                className="flex-1 px-3 py-2 text-sm text-gray-300 truncate"
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
      <div className="p-3 border-t border-gray-700 space-y-2">
        <Link
          href="/documents"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span>📂</span>
          <span>Tài liệu của tôi</span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-2">
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userImage} alt={userName ?? ""} className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
              {userName?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
          )}
          <span className="flex-1 text-sm text-gray-400 truncate">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
