"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface FileResult {
  filename: string;
  status: "ok" | "failed";
  documentId?: string;
  reason?: string;
  code?: number;
}

export default function DocumentUploader() {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setResults([]);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setResults([
          { filename: "—", status: "failed", reason: data.error ?? "Lỗi không xác định" },
        ]);
      } else {
        setResults(data.results ?? []);
        router.refresh();
      }
    } catch {
      setResults([{ filename: "—", status: "failed", reason: "Lỗi kết nối mạng" }]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload tài liệu</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-gray-600 text-sm">
              Kéo thả hoặc <span className="text-blue-500 font-medium">chọn file</span>
            </p>
            <p className="text-gray-400 text-xs mt-1">PDF, DOCX, TXT, MD — tối đa 10MB/file, 10 file</p>
          </label>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "Đang xử lý..." : "Upload & Ingest"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Kết quả:</h3>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                r.status === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              <span>{r.status === "ok" ? "✅" : "❌"}</span>
              <span className="font-medium truncate">{r.filename}</span>
              {r.status === "failed" && r.reason && (
                <span className="text-xs opacity-75">— {r.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
