import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DocumentUploader from "@/components/DocumentUploader";
import DocumentList from "@/components/DocumentList";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, fileType: true, createdAt: true },
  });

  const serializedDocs = documents.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/chat"
              className="text-gray-400 hover:text-gray-600 transition-colors text-sm flex-shrink-0"
            >
              ← Chat
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-base font-semibold text-gray-800 truncate">📂 Tài liệu của tôi</h1>
          </div>
          <span className="text-sm text-gray-500 flex-shrink-0 ml-2">{documents.length} tài liệu</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <DocumentUploader />

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Tài liệu đã upload</h2>
          <DocumentList documents={serializedDocs} />
        </div>
      </div>
    </div>
  );
}
