import { prisma } from "./prisma";
import { toVectorLiteral } from "./vector";
import { TaskType } from "@google/generative-ai";

export const TOP_K = 5;

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string;
  filename: string;
  distance: number;
}

export interface SourceRef {
  documentId: string;
  filename: string;
  chunkId: string;
  snippet: string;
  distance: number;
}

export async function retrieve(
  userId: string,
  questionEmbedding: number[],
  k = TOP_K
): Promise<RetrievedChunk[]> {
  const qVecLiteral = toVectorLiteral(questionEmbedding);

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      c.id,
      c.content,
      c."documentId",
      d.filename,
      c.embedding <=> ${qVecLiteral}::vector AS distance
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c."userId" = ${userId}
    ORDER BY c.embedding <=> ${qVecLiteral}::vector
    LIMIT ${k}
  `;

  return rows;
}

// Ngưỡng cosine distance — dưới ngưỡng này coi là "đủ liên quan"
const RELEVANCE_THRESHOLD = 0.5;

export function buildSources(retrieved: RetrievedChunk[]): SourceRef[] {
  return retrieved
    .filter((r) => r.distance <= RELEVANCE_THRESHOLD)
    .map((r) => ({
      documentId: r.documentId,
      filename: r.filename,
      chunkId: r.id,
      snippet: r.content.slice(0, 200),
      distance: r.distance,
    }));
}

export function buildPrompt(
  question: string,
  retrieved: RetrievedChunk[]
): string {
  const relevant = retrieved.filter((r) => r.distance <= RELEVANCE_THRESHOLD);

  const contextBlock =
    relevant.length > 0
      ? relevant
          .map((r, i) => `--- Tài liệu [${i + 1}]: ${r.filename} ---\n${r.content}`)
          .join("\n\n")
      : "(Không có tài liệu liên quan)";

  return `Bạn là trợ lý AI thông minh. Nhiệm vụ của bạn là TRẢ LỜI ĐẦY ĐỦ câu hỏi của người dùng.

QUY TẮC BẮT BUỘC:
1. Luôn trả lời câu hỏi — KHÔNG ĐƯỢC từ chối trả lời với lý do thiếu tài liệu.
2. Nếu tài liệu có thông tin liên quan → dùng tài liệu làm nguồn chính.
3. Nếu tài liệu KHÔNG đủ hoặc KHÔNG có thông tin → dùng kiến thức của bạn để trả lời.
4. Nếu vừa có tài liệu vừa cần kiến thức ngoài → kết hợp cả hai, trả lời hoàn chỉnh.
5. Trả lời bằng ngôn ngữ của người dùng.
6. Nếu dùng kiến thức ngoài tài liệu, thêm ghi chú ngắn cuối câu: _(Thông tin này từ kiến thức AI)_

Tài liệu người dùng đã upload:
${contextBlock}

Câu hỏi: ${question}

Trả lời:`;
}
