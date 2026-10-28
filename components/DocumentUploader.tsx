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

const FILE_ICONS: Record<string, string> = {
  pdf: "📕",
  docx: "📘",
  txt: "📄",
  md: "📝",
};

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUploader() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function addFiles(newFiles: FileList | File[]) {
    if (uploading) return; // block khi đang upload
    const arr = Array.from(newFiles);
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const filtered = arr.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...filtered].slice(0, 10);
    });
    setResults([]);
    setShowDetail(false);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setSelectedFiles([]);
    setResults([]);
    setShowDetail(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!uploading) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (!uploading && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!uploading && e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setResults([]);
    setShowDetail(false);

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setResults([{ filename: "—", status: "failed", reason: data.error ?? "Lỗi không xác định" }]);
      } else {
        setResults(data.results ?? []);
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setResults([{ filename: "—", status: "failed", reason: "Lỗi kết nối mạng" }]);
    } finally {
      setUploading(false);
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const failCount = results.filter((r) => r.status === "failed").length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload tài liệu</h2>
      <form onSubmit={handleUpload} className="space-y-4">

        {/* Drop zone — disabled khi đang upload */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            uploading
              ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
              : isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-blue-400"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            id="file-input"
            disabled={uploading}
            onChange={handleFileInput}
          />
          <label
            htmlFor="file-input"
            className={`block ${uploading ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="text-4xl mb-2">
              {uploading ? "⏳" : isDragging ? "📂" : "📄"}
            </div>
            <p className="text-gray-600 text-sm">
              {uploading ? (
                <span className="text-gray-400">Đang xử lý, vui lòng chờ...</span>
              ) : (
                <>
                  Kéo thả hoặc{" "}
                  <span className="text-blue-500 font-medium underline">chọn file</span>
                </>
              )}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              PDF, DOCX, TXT, MD — tối đa 10MB/file, 10 file
            </p>
          </label>
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {selectedFiles.length} file đã chọn
              </p>
              {!uploading && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <span className="text-lg flex-shrink-0">
                    {FILE_ICONS[getExt(file.name)] ?? "📄"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate font-medium">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Xóa file này"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          type="submit"
          disabled={uploading || selectedFiles.length === 0}
          className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {uploading
            ? "Đang xử lý..."
            : selectedFiles.length === 0
            ? "Chọn file để upload"
            : `Upload & Ingest ${selectedFiles.length} file`}
        </button>
      </form>

      {/* Kết quả — tóm tắt + xem chi tiết */}
      {results.length > 0 && (
        <div className="mt-4">
          {/* Summary bar */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
            failCount === 0 ? "bg-green-50 border border-green-100" : "bg-yellow-50 border border-yellow-100"
          }`}>
            <div className="flex items-center gap-3 text-sm">
              {okCount > 0 && (
                <span className="text-green-700 font-medium">
                  ✅ {okCount} thành công
                </span>
              )}
              {failCount > 0 && (
                <span className="text-red-600 font-medium">
                  ❌ {failCount} lỗi
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              {showDetail ? "Ẩn chi tiết" : "Xem chi tiết"}
            </button>
          </div>

          {/* Detail list — toggle */}
          {showDetail && (
            <div className="mt-2 space-y-1.5">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    r.status === "ok"
                      ? "bg-green-50 text-green-700 border border-green-100"
                      : "bg-red-50 text-red-700 border border-red-100"
                  }`}
                >
                  <span>{r.status === "ok" ? "✅" : "❌"}</span>
                  <span className="font-medium truncate flex-1">{r.filename}</span>
                  {r.status === "failed" && r.reason && (
                    <span className="text-xs opacity-75 flex-shrink-0">{r.reason}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
