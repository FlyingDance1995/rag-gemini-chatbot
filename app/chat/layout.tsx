import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ChatSidebar from "@/components/ChatSidebar";

export const dynamic = "force-dynamic";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const chats = await prisma.chat.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  const serializedChats = chats.map((c) => ({
    ...c,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <ChatSidebar
        chats={serializedChats}
        userName={session.user.name}
        userImage={session.user.image}
      />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
