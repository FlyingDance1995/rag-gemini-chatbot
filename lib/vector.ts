/**
 * Converts a number array to a pgvector literal string.
 * e.g. [0.1, 0.2, 0.3] -> '[0.1,0.2,0.3]'
 * Cast to ::vector in raw SQL.
 */
export function toVectorLiteral(v: number[]): string {
  return "[" + v.join(",") + "]";
}
