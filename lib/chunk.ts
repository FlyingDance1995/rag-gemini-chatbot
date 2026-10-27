const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const CHUNK_STEP = CHUNK_SIZE - CHUNK_OVERLAP; // 850

export function chunkText(text: string): string[] {
  // Normalize: collapse whitespace, remove NUL bytes
  const normalized = text.replace(/\0/g, "").replace(/\s+/g, " ").trim();

  if (normalized.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end === normalized.length) break;
    start += CHUNK_STEP;
  }

  return chunks;
}
