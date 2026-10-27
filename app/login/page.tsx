import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/chat");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl">
          ✨
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">RAG Gemini Chatbot</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          Upload tài liệu của bạn và hỏi Gemini AI bất cứ điều gì về chúng.
        </p>
        <SignInButton />
        <p className="mt-6 text-xs text-gray-400">
          Đăng nhập để tiếp tục. Tài liệu và lịch sử chat được lưu riêng cho từng tài khoản.
        </p>
      </div>
    </main>
  );
}
