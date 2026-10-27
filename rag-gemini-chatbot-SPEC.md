# Đặc tả dự án: RAG Gemini Chatbot (Next.js + Vercel)

> **Cách dùng tài liệu này:** Mở một Kiro session MỚI ở nhà (mạng không bị chặn npm), tạo một thư mục trống cho project, rồi dán toàn bộ nội dung file này vào chat kèm câu: *"Dựng cho tôi project đúng theo đặc tả này, chạy đầy đủ scaffold + cài dependency + build cho đến khi `npm run build` pass."*
>
> Tài liệu này tự chứa (self-contained): nó mô tả đủ chức năng, tech stack, cấu trúc file, schema, pipeline, và tiêu chí hoàn thành để agent dựng lại từ đầu mà không cần biết gì thêm.

---

## 0. Mục tiêu & bối cảnh

Xây một ứng dụng web **chatbot RAG (Retrieval-Augmented Generation)** theo từng người dùng:

- Người dùng **đăng nhập bằng Google**.
- Người dùng **upload tài liệu** (PDF / DOCX / TXT / Markdown).
- Hệ thống cắt nhỏ tài liệu, tạo **embedding bằng Google Gemini**, lưu vào **Postgres + pgvector**.
- Khi người dùng đặt câu hỏi, hệ thống tìm các đoạn tài liệu liên quan (vector similarity), ghép làm ngữ cảnh rồi gọi **Gemini** trả lời, **stream** câu trả lời về UI.
- **Lịch sử chat** được lưu theo từng người dùng, xem lại và tiếp tục được.
- Mỗi người dùng **chỉ thấy tài liệu và chat của chính mình**.
- Cả BE lẫn FE nằm trong **một project Next.js duy nhất** để **deploy lên Vercel một cú**.

**Ràng buộc quan trọng:** project phải `npm install`, `npx prisma generate` (không cần DB thật) và `npm run build` **thành công mà không cần database sống** — vì Vercel build trước khi có DB, và secrets có thể chưa điền.

---

## 1. Tech stack (ĐÃ CHỐT — không được thay thế)

| Hạng mục | Lựa chọn |
|---|---|
| Framework | **Next.js 15** (`next@^15`, App Router), TypeScript, React 18+ |
| BE + FE | Một app Next.js duy nhất; backend = Route Handlers trong `app/api/**/route.ts` |
| Auth | **NextAuth / Auth.js v5** (`next-auth@^5`), **chỉ Google provider**, **database sessions** qua `@auth/prisma-adapter` |
| Database | **Neon** serverless Postgres |
| ORM | **Prisma** (`prisma` + `@prisma/client`) |
| Vector store | **pgvector** trong CHÍNH DB Neon đó; cột `vector(768)`; tìm kiếm cosine `<=>` qua `$queryRaw` |
| LLM | **Google Gemini** qua `@google/generative-ai`; chat = `gemini-3.5-flash`; embedding = `text-embedding-004` (768 chiều) |
| Parse tài liệu | `pdf-parse` (PDF), `mammoth` (DOCX), đọc UTF-8 thuần (TXT/MD) |
| Styling | Tailwind CSS |
| Sinh id chunk | `@paralleldrive/cuid2` (dùng cho insert chunk bằng raw SQL) |
| Validation | `zod` |

**Loại trừ rõ ràng:** Pinecone / Upstash / Chroma (chỉ dùng pgvector); không JWT session (phải là database session); không provider auth nào khác ngoài Google; không OCR cho PDF scan ảnh (chỉ text trích xuất được).

---

## 2. Danh sách dependency

**Runtime:** `next@^15`, `react`, `react-dom`, `next-auth@^5` (dòng v5/beta), `@auth/prisma-adapter`, `@prisma/client`, `@google/generative-ai`, `pdf-parse`, `mammoth`, `zod`, `@paralleldrive/cuid2`.

**Dev:** `prisma`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/pdf-parse` (nếu resolve sạch, nếu không thì dùng stub `types/pdf-parse.d.ts`), `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `eslint-config-next`.

Scripts trong `package.json` tối thiểu: `dev`, `build`, `start`, `lint`, và **`"postinstall": "prisma generate"`**.

---

## 3. Biến môi trường (env contract)

Tạo 2 file: `.env.example` (commit, chỉ placeholder, mô tả từng biến) và `.env.local` (gitignore, cùng key với giá trị placeholder để người dùng điền sau). Code **chỉ đọc từ `process.env`**, không hard-code secret, không bịa key thật.

```dotenv
# ---- Google Gemini ----
GEMINI_API_KEY="your-gemini-api-key"

# ---- Neon Postgres ----
# Pooled (PgBouncer) dùng ở runtime. Phải có ?sslmode=require&pgbouncer=true
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
# Direct (không pooled) dùng cho prisma migrate / introspection
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"

# ---- NextAuth / Auth.js v5 ----
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
# Sinh bằng: npx auth secret  (hoặc openssl rand -base64 32)
NEXTAUTH_SECRET="generate-a-32-byte-base64-secret"
NEXTAUTH_URL="http://localhost:3000"
```

**Lưu ý sống còn về Auth.js v5:** v5 mặc định đọc `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. Ở đây ta cố ý dùng tên cổ điển `NEXTAUTH_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, nên **phải wire thủ công vào config** — nếu không v5 sẽ ném `MissingSecret`. Cụ thể: `auth.config.ts` truyền `secret: process.env.NEXTAUTH_SECRET` và truyền `clientId`/`clientSecret` vào Google provider. Thêm `trustHost: true` để tránh lỗi `UntrustedHost`.

---

## 4. Prisma schema (BẢN CUỐI — làm đúng)

File `prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}

// ---------- NextAuth models ----------
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  accounts  Account[]
  sessions  Session[]
  documents Document[]
  chunks    Chunk[]
  chats     Chat[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}

// ---------- App models ----------
model Document {
  id        String   @id @default(cuid())
  userId    String
  filename  String
  fileType  String   // "pdf" | "docx" | "txt" | "md"
  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  chunks Chunk[]

  @@index([userId])
}

model Chunk {
  id         String   @id @default(cuid())
  documentId String
  userId     String
  content    String                      @db.Text
  embedding  Unsupported("vector(768)")
  createdAt  DateTime @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([userId])
}

model Chat {
  id        String   @id @default(cuid())
  userId    String
  title     String   @default("New chat")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]

  @@index([userId])
}

model Message {
  id        String   @id @default(cuid())
  chatId    String
  role      String   // "user" | "assistant"
  content   String   @db.Text
  sources   Json?    // mảng { documentId, filename, chunkId, snippet, distance }
  createdAt DateTime @default(now())

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@index([chatId])
}
```

**Điểm then chốt:**
- `embedding Unsupported("vector(768)")`: Prisma không có kiểu vector, chỉ đọc/ghi được qua raw SQL. Prisma Client sẽ **không** select field này vào object `Chunk` (đúng ý), và phải **loại nó khỏi mọi `prisma.chunk.create`** → chunk được insert bằng `$executeRaw`.
- Cascade: xóa Document → xóa Chunk của nó; xóa User → xóa mọi thứ thuộc user; xóa Chat → xóa Message.
- `sources Json?` trên Message: lưu các nguồn đã dùng cho câu trả lời assistant.
- `updatedAt` trên Chat: để sidebar sắp xếp theo hoạt động gần nhất.

---

## 5. Migration pgvector (viết tay DDL)

Tạo `prisma/migrations/0000000000000_init/migration.sql` và `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).

`migration.sql` phải chứa, theo thứ tự:
1. `CREATE EXTENSION IF NOT EXISTS vector;` (TRƯỚC mọi bảng dùng kiểu vector).
2. `CREATE TABLE` cho cả 8 model với đúng cột/kiểu/FK/unique khớp schema. Cột `Chunk.embedding` là `vector(768) NOT NULL`.
3. Các `@@index` (documentId, userId, chatId...).
4. Index ANN cosine:
```sql
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
  ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);
```

**Vì sao HNSW (không phải IVFFlat):** IVFFlat cần dữ liệu đại diện có sẵn trước khi build index (train theo rows hiện có) — bất tiện cho app per-user khi lần upload đầu tiên chưa có gì. HNSW build tăng dần, không cần train, recall tốt khi ít rows (đúng tình huống ở đây). Neon ship pgvector ≥ 0.5 nên HNSW dùng được. Nếu pgvector < 0.5 thì fallback `USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)`.

> Nếu agent có mạng, có thể sinh phần CREATE TABLE bằng `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` rồi chèn thêm dòng `CREATE EXTENSION` ở đầu và dòng index HNSW ở cuối. Nhưng DDL viết tay cũng được, miễn khớp schema.

---

## 6. Cấu trúc file (App Router) — làm đúng từng path

```
<project-root>/
├─ auth.config.ts               # Auth.js config EDGE-SAFE (providers/pages/trustHost/secret/authorized, KHÔNG Prisma)
├─ auth.ts                      # Auth.js v5 đầy đủ: spread auth.config + Prisma adapter + DB sessions
├─ middleware.ts                # cổng auth cho page — build từ auth.config.ts (Edge-safe, không Prisma)
├─ next.config.mjs              # serverExternalPackages: ["pdf-parse","mammoth"]
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ tsconfig.json                # paths: "@/*" -> "./*"
├─ .eslintrc.json               # (hoặc flat config) khớp eslint-config-next
├─ next-env.d.ts
├─ .env.example                 # commit, placeholder
├─ .env.local                   # gitignore, placeholder
├─ .gitignore                   # node_modules, .next, .env*.local
├─ package.json
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
│     ├─ migration_lock.toml
│     └─ 0000000000000_init/migration.sql
├─ types/
│  ├─ next-auth.d.ts            # augment Session.user.id: string
│  └─ pdf-parse.d.ts            # module stub nếu @types/pdf-parse thiếu
├─ lib/
│  ├─ prisma.ts                 # singleton PrismaClient (globalThis guard, KHÔNG connect lúc import)
│  ├─ env.ts                    # requireEnv(name) ném EnvError, chỉ gọi trong handler/lazy getter
│  ├─ gemini.ts                 # lazy getGenAI, embedText(text, taskType), embedBatch, chat model
│  ├─ chunk.ts                  # chunkText (1000/150)
│  ├─ vector.ts                 # toVectorLiteral(number[])
│  ├─ parse.ts                  # extractText(buffer, fileType) dispatch
│  └─ rag.ts                    # TOP_K=5, retrieve(), buildPrompt()
├─ components/
│  ├─ SignInButton.tsx
│  ├─ SignOutButton.tsx
│  ├─ DocumentUploader.tsx
│  ├─ DocumentList.tsx
│  ├─ ChatWindow.tsx
│  └─ ChatSidebar.tsx
└─ app/
   ├─ layout.tsx                # root layout, Tailwind globals, SessionProvider wrapper
   ├─ globals.css               # Tailwind directives
   ├─ page.tsx                  # redirect: authed -> /chat, chưa auth -> /login
   ├─ login/page.tsx            # nút "Sign in with Google" (client)
   ├─ chat/
   │  ├─ layout.tsx             # shell có sidebar (danh sách chat + link documents)
   │  ├─ page.tsx               # chat mới/trống
   │  └─ [chatId]/page.tsx      # một hội thoại cụ thể (load messages)
   ├─ documents/page.tsx        # form upload + danh sách tài liệu + xóa
   └─ api/
      ├─ auth/[...nextauth]/route.ts   # export { GET, POST } = handlers
      ├─ documents/
      │  ├─ route.ts                   # GET list; POST upload+ingest
      │  └─ [id]/route.ts              # DELETE 1 doc (cascade chunk), check owner
      └─ chat/
         ├─ route.ts                   # POST: RAG trả lời (stream); tạo Chat nếu chưa có
         └─ [chatId]/route.ts          # GET messages của chat; DELETE 1 chat
```

---

## 7. RAG pipeline (chi tiết)

### 7.1 Chunking — `lib/chunk.ts`
`chunkText(text: string): string[]`. Hằng số cố định: `CHUNK_SIZE = 1000` ký tự, `CHUNK_OVERLAP = 150`. Trượt cửa sổ `CHUNK_SIZE`, mỗi bước tiến `CHUNK_SIZE - CHUNK_OVERLAP = 850`; normalize whitespace trước (gộp khoảng trắng, bỏ NUL); trim; bỏ chunk rỗng. Chunk theo ký tự (không cần tokenizer).

### 7.2 Embedding — `lib/gemini.ts`
- `getGenAI()`: khởi tạo **lazy** `new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"))` — chỉ gọi lúc runtime, không ở top-level module (để build không ném khi thiếu key).
- `embedText(text, taskType): Promise<number[]>` dùng model `text-embedding-004`, gọi `model.embedContent({ content: { parts: [{ text }] }, taskType })`, trả `embedding.values` (độ dài 768, **assert** đúng 768).
  - `taskType` **bắt buộc và tường minh**: ingestion dùng `RETRIEVAL_DOCUMENT`, câu hỏi chat dùng `RETRIEVAL_QUERY` (text-embedding-004 sinh vector tối ưu theo task, phải khớp cặp bất đối xứng này).
- `embedBatch(texts): Promise<{ content, vectorLiteral }[]>`: embed mọi chunk với `RETRIEVAL_DOCUMENT`, concurrency cố định `EMBED_CONCURRENCY = 5` (xử lý theo đợt 5 call song song). Mỗi chunk retry 2 lần backoff mũ khi gặp 429/5xx; nếu vẫn fail thì **throw** → fail cả document (all-or-nothing, không có đường "bỏ chunk hỏng").
- Chat model: `gemini-3.5-flash`.
- Metric: **cosine** (`<=>` + `vector_cosine_ops`) vì text-embedding-004 không đảm bảo vector chuẩn hóa.

### 7.3 `lib/vector.ts`
`toVectorLiteral(v: number[]): string` → chuỗi `'[0.12,0.34,...]'`, cast `::vector` trong SQL.

### 7.4 `lib/parse.ts`
`extractText(buffer, fileType)`:
- `pdf` → `pdf-parse` qua **dynamic import** (`const pdf = (await import("pdf-parse")).default;`): `(await pdf(buffer)).text`.
- `docx` → `mammoth`: `(await mammoth.extractRawText({ buffer })).value`.
- `txt` / `md` → `buffer.toString("utf-8")`.
- Loại khác → reject.

### 7.5 Ingestion (write path) — trong `POST /api/documents`
Với mỗi file: validate → đọc Buffer → `extractText` → `chunkText` → `embedBatch` (bước mạng chậm, làm **trước** transaction) → mở **một** `prisma.$transaction` tạo `Document` rồi `tx.$executeRaw` insert từng chunk:

```ts
import { createId } from "@paralleldrive/cuid2";

const chunkRows = await embedBatch(chunks); // [{ content, vectorLiteral }]

await prisma.$transaction(async (tx) => {
  const doc = await tx.document.create({ data: { userId, filename, fileType } });
  for (const { content, vectorLiteral } of chunkRows) {
    await tx.$executeRaw`
      INSERT INTO "Chunk" ("id","documentId","userId","content","embedding","createdAt")
      VALUES (${createId()}, ${doc.id}, ${userId}, ${content}, ${vectorLiteral}::vector, now())
    `;
  }
  return doc;
});
```

**Vì sao `createId()` chứ không phải `cuid()`:** `@default(cuid())` trong schema là default **phía client của Prisma**, chỉ áp dụng cho `prisma.chunk.create`. Chunk ở đây insert bằng `$executeRaw` nên raw SQL **không** kích hoạt default đó → INSERT phải tự cấp `"id"` bằng `createId()` từ `@paralleldrive/cuid2`. Tagged-template `$executeRaw` tự parameterize mọi giá trị → không có SQL injection dù content do user cung cấp. Lỗi bất kỳ trong callback → Postgres rollback toàn bộ (không có document mồ côi).

### 7.6 Retrieval (read path) — `lib/rag.ts`
`retrieve(userId, questionEmbedding, k = TOP_K)` với `TOP_K = 5`. `questionEmbedding` sinh bằng `embedText(question, "RETRIEVAL_QUERY")`:

```ts
const rows = await prisma.$queryRaw<RetrievedChunk[]>`
  SELECT c.id, c.content, c."documentId", d.filename,
         c.embedding <=> ${qVecLiteral}::vector AS distance
  FROM "Chunk" c
  JOIN "Document" d ON d.id = c."documentId"
  WHERE c."userId" = ${userId}
  ORDER BY c.embedding <=> ${qVecLiteral}::vector
  LIMIT ${k}
`;
```

`<=>` là cosine distance (nhỏ = giống hơn). `WHERE c."userId" = ${userId}` là **điểm chốt cô lập dữ liệu theo user** khi truy hồi. Định nghĩa kiểu `RetrievedChunk { id, content, documentId, filename, distance }`.

### 7.7 Prompt assembly — `lib/rag.ts`
`buildPrompt(question, retrieved)` ghép: (1) preamble yêu cầu Gemini **chỉ** trả lời dựa trên ngữ cảnh, nói "không biết" khi ngữ cảnh không đủ, trả lời bằng ngôn ngữ của người dùng; (2) các chunk nối dạng `--- Source [n] ({filename}) ---\n{content}`; (3) câu hỏi cuối cùng. `sources` cho message assistant build từ `retrieved` (documentId, filename, chunkId, snippet ngắn, distance), lưu vào `Message` và trả về UI.

### 7.8 Streaming
Chat Route Handler dùng `generateContentStream`, trả `ReadableStream` với `Content-Type: text/plain; charset=utf-8` (KHÔNG tự set `Transfer-Encoding`). Nếu init stream fail → fallback `generateContent` trả JSON một lần. Message assistant + sources lưu **sau khi** ghép đủ text (lúc stream kết thúc) để lịch sử luôn đầy đủ.

---

## 8. Auth.js v5 — split-config (bắt buộc đúng pattern này)

**`auth.config.ts` (EDGE-SAFE — import bởi cả `middleware.ts` lẫn `auth.ts`; KHÔNG Prisma, KHÔNG adapter):**
```ts
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
```

**`auth.ts` (đầy đủ — chỉ Node runtime; import bởi route handlers / Server Components):**
```ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  callbacks: {
    ...authConfig.callbacks,
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

**Vì sao phải tách:** `middleware.ts` chạy ở **Edge runtime** — `@prisma/client` không chạy được ở Edge. Nếu middleware import `auth.ts` đầy đủ (có `PrismaAdapter`), nó kéo `PrismaClient` vào Edge bundle → vỡ build/crash runtime. Tách Prisma/adapter vào `auth.ts`, giữ phần Edge-safe ở `auth.config.ts`, middleware chỉ import `auth.config.ts`.

**`middleware.ts`:**
```ts
import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
```

**Route auth:** `app/api/auth/[...nextauth]/route.ts` → `export const { GET, POST } = handlers;`

**`types/next-auth.d.ts`:** module augmentation thêm `id: string` vào `Session["user"]` để TS biết `session.user.id`.

### Bảo vệ route — 2 lớp
1. **`middleware.ts`** chặn điều hướng page (dùng callback `authorized`, redirect về `/login`). Matcher loại trừ `/login`, `/api/auth/*`, và nội bộ Next/static. Đây chỉ là cổng UX, kiểm tra sự hiện diện của cookie session, KHÔNG chạm DB.
2. **Auth trong từng API route** là ranh giới bảo mật thật: mỗi `app/api/**/route.ts` gọi `const session = await auth();`, trả `401` nếu `!session?.user?.id`, rồi scope mọi query theo `session.user.id`. Route mutating kiểm tra lại quyền sở hữu (ví dụ xóa document chỉ khi `document.userId === session.user.id`; không phải chủ → trả `404` để không lộ sự tồn tại).

---

## 9. API — đặc tả từng endpoint

### `POST /api/documents` — upload & ingest (runtime = "nodejs")
Nhận `multipart/form-data`, 1..10 file. Mỗi file: validate → extract → chunk → embedBatch → `$transaction` insert. **Contract trả về 2 tầng:**
- HTTP top-level chỉ dành cho lỗi toàn request: `401 {error:"Unauthorized"}`, `400 {error:"No files provided"}`, `400 {error:"Too many files"}`.
- Ngược lại luôn `200` với mảng kết quả per-file:
```ts
{ results: Array<{
    filename: string;
    status: "ok" | "failed";
    documentId?: string;   // khi status === "ok"
    reason?: string;       // khi status === "failed"
    code?: number;         // 413 quá lớn, 415 sai kiểu, 422 parse/embed fail
}> }
```

### `GET /api/documents` — list tài liệu của user (scope theo session).

### `DELETE /api/documents/[id]` — xóa 1 tài liệu (check owner, cascade xóa chunk; không phải owner → 404).

### `POST /api/chat` — RAG trả lời (runtime = "nodejs")
Body zod: `{ message: string (1..4000), chatId?: string (cuid) }`. Scope theo `auth()`. Embed câu hỏi `RETRIEVAL_QUERY` → `retrieve` top-K → `buildPrompt` → tạo `Chat` nếu chưa có → stream `generateContentStream` (fallback `generateContent`) → lưu `Message` assistant + `sources` khi stream xong.

### `GET /api/chat/[chatId]` — lấy messages của 1 chat (scope owner).
### `DELETE /api/chat/[chatId]` — xóa 1 chat (cascade message).

---

## 10. Validation & xử lý lỗi

**Validate file:** ≥1 file; mỗi file ≤ `MAX_FILE_BYTES = 10*1024*1024`; đuôi ∈ `{.pdf,.docx,.txt,.md}`; ≤10 file/request. **Đuôi file là tín hiệu chính** (và suy ra `fileType`). MIME là guard phụ, áp bất đối xứng:
- `.pdf` → yêu cầu MIME `application/pdf` (strict).
- `.docx` → yêu cầu `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (strict).
- `.txt` / `.md` → chấp nhận `text/plain`, `text/markdown`, hoặc MIME rỗng/thiếu (vì browser hay gửi `.md` là `text/plain`).

**Validate chat:** `message` 1..4000 ký tự; `chatId` nếu có phải thuộc user (không thì 404).

**Embedding trả về:** assert `Array.isArray(values) && values.length === 768`; sai → coi là embed fail.

**Bảng lỗi rút gọn:** no session → 401; no files → 400; >10 files → 400; file quá lớn → per-file 413; sai kiểu → per-file 415; parse/embed lỗi → per-file 422; thiếu `GEMINI_API_KEY` ở chat → 500; retrieve lỗi → 500; stream init fail → fallback non-stream; cả hai fail → 502; không có chunk nào của user → vẫn trả lời với ngữ cảnh rỗng (prompt bảo model nói thiếu tài liệu). `requireEnv` ném `EnvError` bắt ở biên route → map thành 500 với message rõ ràng. Log bằng `console.error/warn`, KHÔNG log giá trị secret.

---

## 11. Build-time vs runtime (ĐIỀU KIỆN HOÀN THÀNH then chốt)

`next build` phải chạy được **không cần DB sống và không cần secret thật**. Đảm bảo:
1. **Không truy cập env ở top-level** gây throw. `GoogleGenerativeAI` khởi tạo lazy trong `getGenAI()`; `requireEnv` chỉ gọi trong handler/lazy getter.
2. **Prisma generate, không connect lúc build.** `postinstall: prisma generate` sinh type từ schema (không connect). Singleton `lib/prisma.ts` chỉ `new PrismaClient()`, không mở kết nối cho tới query đầu tiên (runtime). Không route nào query lúc module load.
3. **Route handler là dynamic** (dùng `auth()`/Prisma → request-dependent). Page đọc dữ liệu đặt `export const dynamic = "force-dynamic"` để build không static-generate chạm DB.
4. **`pdf-parse`/`mammoth`:** import `pdf-parse` **động** trong hàm parse; đặt `serverExternalPackages: ["pdf-parse","mammoth"]` trong `next.config.mjs`; route documents `runtime = "nodejs"`. (Next 15 dùng key top-level `serverExternalPackages`; Next 14 là `experimental.serverComponentsExternalPackages` — vì pin Next 15 nên dùng key top-level.)
5. **`Unsupported("vector(768)")`** được `prisma generate` hỗ trợ (chỉ bỏ field khỏi typed model), không chạm DB lúc build.
6. **Type cho dep thiếu @types:** `types/pdf-parse.d.ts` khai báo `declare module "pdf-parse"` để type-check không cần `@types/pdf-parse`.
7. **`migrate` tách khỏi build:** apply schema bằng `prisma migrate deploy` (dùng `DIRECT_URL`) như bước riêng, không phải điều kiện để `next build` thành công.
8. **Middleware Prisma-free (Edge-safe):** `middleware.ts` build từ `auth.config.ts` (không adapter, không Prisma) nên build không trace `@prisma/client` vào Edge bundle.

---

## 12. UI (các component)

- `SignInButton` / `SignOutButton`: wrapper mỏng của v5 `signIn("google")` / `signOut()`.
- `ChatWindow`: list message + ô nhập; đọc stream, append token dần; render `sources` dạng citation thu gọn dưới mỗi câu trả lời assistant.
- `ChatSidebar`: list `Chat` của user (title, sắp theo `updatedAt`), nút "New chat", link `/documents`.
- `DocumentUploader`: `<input type="file" multiple>`, POST `FormData` tới `/api/documents`, hiển thị kết quả/tiến độ từng file từ mảng `results`.
- `DocumentList`: list tài liệu + nút xóa gọi `DELETE /api/documents/[id]`.
- Server Component fetch dữ liệu ban đầu (chat list, messages, documents) trực tiếp qua Prisma + `auth()` để first paint đã scope theo user; Client Component lo tương tác + streaming.
- `app/page.tsx`: redirect-only (authed → `/chat`, chưa auth → `/login`), không có landing.

---

## 13. README.md phải có

- Mô tả app làm gì.
- Setup: tạo Neon DB + bật pgvector; set `DATABASE_URL` (pooled) + `DIRECT_URL` (direct); tạo Google OAuth web client với redirect URI `http://localhost:3000/api/auth/callback/google` (local) và `https://<app>.vercel.app/api/auth/callback/google` (prod); liệt kê đủ 7 env var; `npm install`; `npx prisma migrate deploy`; `npm run dev`.
- Deploy Vercel: import repo, dùng Neon integration, set đủ env var (NEXTAUTH_URL = origin production), `postinstall` chạy `prisma generate`, route ingestion/chat chạy Node runtime.

---

## 14. Tiêu chí hoàn thành (ĐỊNH NGHĨA DONE — agent phải verify)

Chạy từ thư mục gốc project, theo thứ tự, **cả ba phải thành công**:
1. `npm install` — resolve sạch, không lỗi peer chặn.
2. `npx prisma generate` — thành công **KHÔNG cần DB sống** (chỉ sinh client từ schema).
3. `npm run build` — compile **không lỗi TypeScript**.

Code chạm DB (Prisma query, `auth()`, routes) vẫn phải **type-check và build được không cần DB sống** (nhờ lazy env, dynamic route, Edge-safe middleware split). Nếu build báo lỗi type/thiếu type, sửa cho tới khi cả 3 lệnh pass. App **không cần chạy đầy đủ** khi chưa có secret thật và Neon DB — nhưng install + prisma generate + build phải pass.

---

## 15. Lưu ý về scaffold

Nếu dựng mới, có thể bắt đầu bằng:
```
npx create-next-app@latest . --typescript --tailwind --app --eslint --import-alias "@/*" --no-src-dir --use-npm --yes
```
Sau scaffold: pin `next` về `^15` (và `eslint-config-next` tương ứng) nếu create-next-app kéo major mới hơn; thêm các dependency ở mục 2; rồi viết các file ứng dụng theo mục 6–12. Nếu một flag bị version hiện tại từ chối, bỏ flag đó và set tương đương thủ công (ví dụ import alias trong `tsconfig.json`), giữ nguyên TS + Tailwind + App Router. `next-auth@beta` là dòng v5; nếu cần tag beta cụ thể hợp Next 15 thì pin bản v5 beta cài sạch.

---

## 16. Ngoài phạm vi

Không làm: CMS bán điện thoại; auto-reply Zalo; provider auth ngoài Google; JWT session; Pinecone/Upstash/Chroma; OCR PDF scan ảnh; chat realtime collaborative; billing/quota.
```