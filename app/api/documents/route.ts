import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/parse";
import { chunkText } from "@/lib/chunk";
import { embedBatch } from "@/lib/gemini";
import { createId } from "@paralleldrive/cuid2";
import { EnvError } from "@/lib/env";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;
const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "md"] as const;
type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

function getFileType(filename: string): AllowedExt | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext as AllowedExt)) return ext as AllowedExt;
  return null;
}

function validateMime(fileType: AllowedExt, mimeType: string): boolean {
  if (fileType === "pdf") return mimeType === "application/pdf";
  if (fileType === "docx")
    return (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  // txt / md: accept text/plain, text/markdown, or empty
  return !mimeType || mimeType.startsWith("text/");
}

// GET /api/documents — list user's documents
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, fileType: true, createdAt: true },
  });

  return NextResponse.json({ documents });
}

// POST /api/documents — upload & ingest
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: "Too many files (max 10)" }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async (file) => {
      const filename = file.name;

      // Validate extension
      const fileType = getFileType(filename);
      if (!fileType) {
        return { filename, status: "failed" as const, reason: "Unsupported file type", code: 415 };
      }

      // Validate size
      if (file.size > MAX_FILE_BYTES) {
        return { filename, status: "failed" as const, reason: "File too large (max 10MB)", code: 413 };
      }

      // Validate MIME
      const mimeType = file.type ?? "";
      if (!validateMime(fileType, mimeType)) {
        return { filename, status: "failed" as const, reason: `MIME type mismatch: ${mimeType}`, code: 415 };
      }

      try {
        // Convert to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract text
        const text = await extractText(buffer, fileType);

        // Chunk
        const chunks = chunkText(text);
        if (chunks.length === 0) {
          return { filename, status: "failed" as const, reason: "No text content extracted", code: 422 };
        }

        // Embed (all-or-nothing)
        const chunkRows = await embedBatch(chunks);

        // Persist in single transaction
        const doc = await prisma.$transaction(async (tx) => {
          const document = await tx.document.create({
            data: { userId, filename, fileType },
          });

          for (const { content, vectorLiteral } of chunkRows) {
            await tx.$executeRaw`
              INSERT INTO "Chunk" ("id","documentId","userId","content","embedding","createdAt")
              VALUES (${createId()}, ${document.id}, ${userId}, ${content}, ${vectorLiteral}::vector, now())
            `;
          }

          return document;
        });

        return { filename, status: "ok" as const, documentId: doc.id };
      } catch (err) {
        if (err instanceof EnvError) throw err; // bubble up env errors
        console.error(`Failed to ingest ${filename}:`, err);
        return {
          filename,
          status: "failed" as const,
          reason: err instanceof Error ? err.message : "Processing failed",
          code: 422,
        };
      }
    })
  );

  return NextResponse.json({ results });
}
