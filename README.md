# RAG Gemini Chatbot

Ứng dụng chatbot RAG (Retrieval-Augmented Generation) per-user, xây trên **Next.js 15**, **Google Gemini**, và **Neon Postgres + pgvector**.

## Tính năng

- 🔐 Đăng nhập bằng Google (NextAuth v5, database sessions)
- 📄 Upload tài liệu PDF, DOCX, TXT, Markdown (tối đa 10MB/file)
- 🧠 Tạo embedding bằng `text-embedding-004` (768 chiều), lưu vào pgvector
- 💬 Chat RAG: tìm chunk liên quan → ghép context → Gemini trả lời stream
- 📚 Lịch sử chat và tài liệu riêng biệt theo từng user
- 🚀 Deploy lên Vercel một lệnh

---

## Yêu cầu

- **Node.js 18+**
- Tài khoản **[Neon](https://neon.tech)** — Postgres serverless có pgvector
- **Google AI Studio** API key — cho Gemini chat + embedding
- **Google OAuth** credentials — cho đăng nhập Google

---

## Setup từng bước

### Bước 1 — Tạo Neon Database

1. Đăng ký tại [neon.tech](https://neon.tech) → tạo project mới
2. Vào **Dashboard → Connection Details**, copy 2 connection string:
   - **Pooled** (có `pgbouncer=true`) → dùng cho `DATABASE_URL`
   - **Direct** (không có pooler) → dùng cho `DIRECT_URL`
3. pgvector sẽ được bật tự động khi chạy migration

### Bước 2 — Lấy Gemini API Key

1. Vào [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Nhấn **Create API Key** → copy key
3. Đây là `GEMINI_API_KEY`

### Bước 3 — Tạo Google OAuth Credentials

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Nhấn **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Thêm **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` ← cho local dev
   - `https://<your-app>.vercel.app/api/auth/callback/google` ← cho production
5. Copy **Client ID** → `GOOGLE_CLIENT_ID`
6. Copy **Client Secret** → `GOOGLE_CLIENT_SECRET`

### Bước 4 — Điền file `.env.local`

Mở file `.env.local` ở thư mục gốc dự án và điền đầy đủ:

```dotenv
# Google Gemini
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-2.0-flash"

# Neon Postgres — Pooled (runtime)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Neon Postgres — Direct (migrate)
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# NextAuth secret — chạy lệnh bên dưới để sinh
NEXTAUTH_SECRET="<output của: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\">"

# URL app
NEXTAUTH_URL="http://localhost:3000"
```

> **Sinh NEXTAUTH_SECRET** — chạy lệnh này trong terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```
> Copy output dán vào `NEXTAUTH_SECRET`.

### Bước 5 — Cài dependencies

```bash
npm install --ignore-scripts
```

> Dùng `--ignore-scripts` để bỏ qua `postinstall` trong lần đầu cài.

### Bước 6 — Generate Prisma Client

```bash
npx prisma generate
```

### Bước 7 — Chạy Database Migration

```bash
npx prisma migrate deploy
```

> Lệnh này cần `DIRECT_URL` trong `.env.local`. Nó sẽ tạo tất cả bảng và bật pgvector trên Neon.

### Bước 8 — Chạy development server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) → đăng nhập bằng Google → upload tài liệu → bắt đầu chat.

---

## Deploy lên Vercel

1. Push code lên GitHub (đảm bảo `.env.local` đã trong `.gitignore`)
2. Import repo vào [vercel.com](https://vercel.com)
3. Dùng **Neon Vercel Integration** để tự inject `DATABASE_URL` và `DIRECT_URL`
4. Thêm thủ công các biến còn lại:
   | Biến | Giá trị |
   |------|---------|
   | `GEMINI_API_KEY` | API key từ AI Studio |
   | `GEMINI_MODEL` | `gemini-2.0-flash` |
   | `GOOGLE_CLIENT_ID` | OAuth Client ID |
   | `GOOGLE_CLIENT_SECRET` | OAuth Client Secret |
   | `NEXTAUTH_SECRET` | Random 32-byte base64 |
   | `NEXTAUTH_URL` | `https://<your-app>.vercel.app` |
5. Deploy → sau deploy lần đầu chạy migration một lần từ local:
   ```bash
   npx prisma migrate deploy
   ```

---

## Cấu trúc project

```
├── app/
│   ├── api/auth/           # NextAuth handler
│   ├── api/documents/      # Upload, list, delete tài liệu
│   ├── api/chat/           # RAG chat (streaming)
│   ├── chat/               # Chat UI
│   ├── documents/          # Quản lý tài liệu
│   └── login/              # Trang đăng nhập
├── components/             # React components
├── lib/
│   ├── gemini.ts           # Gemini AI (chat + embedding), đọc GEMINI_API_KEY, GEMINI_MODEL
│   ├── rag.ts              # RAG pipeline (retrieve + buildPrompt)
│   ├── chunk.ts            # Chunking văn bản
│   ├── parse.ts            # Parse PDF/DOCX/TXT/MD
│   ├── vector.ts           # pgvector literal helper
│   ├── prisma.ts           # Prisma singleton
│   └── env.ts              # requireEnv helper
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # SQL migrations
├── types/                  # TypeScript augmentations
├── auth.config.ts          # Auth.js config (Edge-safe)
├── auth.ts                 # Auth.js full (Node + Prisma)
└── middleware.ts            # Route protection
```

---

## Biến môi trường — tổng hợp

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | ✅ | Model chat, ví dụ `gemini-2.0-flash` |
| `DATABASE_URL` | ✅ | Neon pooled connection string (runtime) |
| `DIRECT_URL` | ✅ | Neon direct connection (prisma migrate) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth Client Secret |
| `NEXTAUTH_SECRET` | ✅ | Random 32-byte base64 secret |
| `NEXTAUTH_URL` | ✅ | App URL (`http://localhost:3000` hoặc Vercel URL) |
