type SupportedFileType = "pdf" | "docx" | "txt" | "md";

export async function extractText(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<string> {
  switch (fileType) {
    case "pdf": {
      // Dynamic import to avoid top-level load (build-safe)
      const pdf = (await import("pdf-parse")).default;
      const result = await pdf(buffer);
      return result.text;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt":
    case "md": {
      return buffer.toString("utf-8");
    }
    default: {
      const _exhaustive: never = fileType;
      throw new Error(`Unsupported file type: ${_exhaustive}`);
    }
  }
}
