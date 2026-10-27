import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ChatWindow from "@/components/ChatWindow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { chatId } = await params;

  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!chat) notFound();

  const messages = chat.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    sources: m.sources as
      | Array<{
          documentId: string;
          filename: string;
          chunkId: string;
          snippet: string;
          distance: number;
        }>
      | null,
  }));

  return <ChatWindow chatId={chatId} initialMessages={messages} />;
}
