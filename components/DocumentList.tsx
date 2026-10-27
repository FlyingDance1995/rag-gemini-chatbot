"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  filename: string;
  fileType: string;
  createdAt: string | Date;
}

interface DocumentListProps {
  documents: Document[];
}

const FILE_ICONS: Record<string, string> = {
  pdf: "📕",
  docx: "📘",
  txt: "📄",
  md: "📝",
};

export default function DocumentList({ documents }: DocumentListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Xóa tài liệu này? Tất cả chunk liên quan cũng bị xóa.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-5xl mb-3">🗂️</div>
        <p>Chưa có tài liệu nào. Upload file để bắt đầu!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl flex-shrink-0">
              {FILE_ICONS[doc.fileType] ?? "📄"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
              <p className="text-xs text-gray-400">
                {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(doc.id)}
            disabled={deleting === doc.id}
            className="flex-shrink-0 ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Xóa tài liệu"
          >
            {deleting === doc.id ? "⏳" : "🗑️"}
          </button>
        </div>
      ))}
    </div>
  );
}
