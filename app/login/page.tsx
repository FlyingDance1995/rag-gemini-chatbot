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
        <div className="w-16 h-16 mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="50%" stopColor="#8b5cf6"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="22" fill="url(#lg1)"/>
            <path d="M50 18 C50 18 54 38 62 46 C70 54 82 50 82 50 C82 50 70 54 62 62 C54 70 50 82 50 82 C50 82 46 70 38 62 C30 54 18 50 18 50 C18 50 30 46 38 38 C46 30 50 18 50 18Z" fill="white" opacity="0.95"/>
            <path d="M76 24 C76 24 77.5 30 80 32.5 C82.5 35 88 34 88 34 C88 34 82.5 35 80 37.5 C77.5 40 76 46 76 46 C76 46 74.5 40 72 37.5 C69.5 35 64 34 64 34 C64 34 69.5 35 72 32.5 C74.5 30 76 24 76 24Z" fill="white" opacity="0.7"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">RAG Gemini Chatbot</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          Upload tài liệu của bạn và hỏi Gemini AI bất cứ điều gì về chúng.
        </p>
        <div className="flex justify-center">
          <SignInButton />
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Đăng nhập để tiếp tục. Tài liệu và lịch sử chat được lưu riêng cho từng tài khoản.
        </p>
      </div>
    </main>
  );
}
