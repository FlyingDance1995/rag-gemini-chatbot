import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { embedText, getChatModel } from "@/lib/gemini";
import { retrieve, buildPrompt, buildSources } from "@/lib/rag";
import { EnvError } from "@/lib/env";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TaskType } from "@google/generative-ai";

export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  chatId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Validate body
  let body: { message: string; chatId?: string };
  try {
    const raw = await req.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, chatId: requestedChatId } = body;

  // Validate chatId ownership if provided
  if (requestedChatId) {
    const chat = await prisma.chat.findFirst({
      where: { id: requestedChatId, userId },
    });
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
  }

  try {
    // 1. Embed the question
    const questionEmbedding = await embedText(message, TaskType.RETRIEVAL_QUERY);

    // 2. Retrieve relevant chunks
    const retrieved = await retrieve(userId, questionEmbedding);

    // 3. Build prompt
    const prompt = buildPrompt(message, retrieved);

    // 4. Create or get chat
    let chatId = requestedChatId;
    if (!chatId) {
      const title =
        message.length > 50 ? message.slice(0, 50) + "..." : message;
      const newChat = await prisma.chat.create({
        data: { userId, title },
      });
      chatId = newChat.id;
    }

    // 5. Save user message
    await prisma.message.create({
      data: { chatId, role: "user", content: message },
    });

    // 6. Build sources metadata
    const sources = buildSources(retrieved);

    // 7. Stream response
    const model = getChatModel();

    let streamResult;
    let useStream = true;
    try {
      streamResult = await model.generateContentStream(prompt);
    } catch (err) {
      console.warn("Stream init failed, falling back to generateContent:", err);
      useStream = false;
    }

    if (useStream && streamResult) {
      // Streaming response
      const encoder = new TextEncoder();
      let fullText = "";

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }

            // Send sources as a trailing marker
            if (sources.length > 0) {
              controller.enqueue(
                encoder.encode(`\n\n__SOURCES__:${JSON.stringify(sources)}`)
              );
            }

            // Save assistant message after stream ends
            await prisma.message.create({
              data: {
                chatId: chatId!,
                role: "assistant",
                content: fullText,
                sources: sources.length > 0 ? (sources as unknown as Prisma.InputJsonValue) : undefined,
              },
            });

            // Update chat timestamp
            await prisma.chat.update({
              where: { id: chatId },
              data: { updatedAt: new Date() },
            });
          } catch (err) {
            console.error("Stream error:", err);
            controller.error(err);
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Chat-Id": chatId,
        },
      });
    } else {
      // Fallback: non-streaming
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        await prisma.message.create({
          data: {
            chatId: chatId!,
            role: "assistant",
            content: text,
            sources: sources.length > 0 ? (sources as unknown as Prisma.InputJsonValue) : undefined,
          },
        });

        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        return NextResponse.json(
          { reply: text, sources, chatId },
          { headers: { "X-Chat-Id": chatId } }
        );
      } catch (err) {
        console.error("Fallback generateContent failed:", err);
        return NextResponse.json(
          { error: "AI model error" },
          { status: 502 }
        );
      }
    }
  } catch (err) {
    if (err instanceof EnvError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
