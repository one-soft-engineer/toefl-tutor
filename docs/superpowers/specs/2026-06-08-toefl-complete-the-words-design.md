# TOEFL Complete-the-Words 出題與練習工具 — 設計文件

- 日期：2026-06-08
- 狀態：設計已確認，待寫實作計畫
- 類型：單人 SaaS（本地出題工具 + 雲端練習站）

## 1. 背景與目標

針對 TOEFL iBT 2026 Reading 的 **Complete the Words** 題型，建立一套個人練習工具：

1. 使用者請 Claude Code 出題，題目寫成本地 JSON 檔
2. 本地 `next dev` 讀 JSON，渲染成可互動的作答頁，本地批改
3. 交卷後自動把「題目 + 作答 + 錯字」上傳雲端
4. 雲端站可重練考過/答錯的題，並有錯字本

### 題型規格（對齊正式 TOEFL 2026）

- 一段約 **70 字短文**，內含挖空的單字
- 每個空格顯示單字的**部分字母**，使用者填入**缺少的字母**
- 挖空位置在單字的**中間或結尾**
- 每題固定 **10 個**挖空
- 一律**美式拼寫**

來源：[goarno.io](https://goarno.io/blog/complete-the-words-practice-questions-with-answers-toefl-new-format/)、[testsucceed.com](https://testsucceed.com/materials/tests/toefl_new/en/description/reading/toefl-2026-new-reading-task1-complete-the-words.html)、[toeflresources.com](https://www.toeflresources.com/blog/2026_toefl_format_revealed/)

## 2. 範圍與決策

| 項目 | 決策 |
|------|------|
| 使用者 | **單人**。別人要用就 clone 自己跑、接自己的 Claude Code |
| 架構 | **單一 Next.js repo**，本地與雲端同庫，靠環境變數區分功能 |
| 出題交接 | Claude Code 寫**本地 JSON 檔**，本地 app 讀取 |
| 線上練習 | **重玩考過/答錯的題**（雲端不接 AI 生成） |
| 上傳時機 | **交卷後自動上傳** |
| 雲端存取保護 | **GitHub OAuth（NextAuth）**，只放行本人帳號 |
| 上傳 API 驗證 | 另用 **Bearer token**（本地非瀏覽器登入態） |
| ORM / DB | **Drizzle + Neon Postgres**（Vercel 原生、serverless 友善、無 codegen） |
| 部署 | Vercel |

### 不做（YAGNI）

- 多使用者 / 多租戶 / 付費
- 雲端 AI 出題
- 本地資料庫（本地只讀 JSON，批改在本地，結果 POST 到雲端唯一的 DB）

## 3. 整體架構

```
┌─────────────── 本地 (next dev, LOCAL_MODE=1) ───────────────┐
│  Claude Code 出題 → 寫入 questions/*.json                    │
│         ↓                                                    │
│  本地作答頁 /practice/[file]                                 │
│   - 讀 JSON、渲染「短文 + 10 挖空」                          │
│   - 使用者填字 → gradeAttempt 本地批改                       │
│         ↓ 交卷自動                                            │
│  POST → https://<vercel>/api/results  (Bearer UPLOAD_TOKEN)  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────── 雲端 (Vercel) ───────────────────────────────┐
│  POST /api/results → 寫入 Neon Postgres (Drizzle)            │
│  GitHub OAuth (NextAuth)，只放行本人帳號                     │
│  /review        重練考過/答錯的題                            │
│  /wrong-words   錯字本                                        │
└──────────────────────────────────────────────────────────────┘
```

同一份程式碼。本地與雲端差別只在環境變數與顯示的路由。

## 4. 資料模型（Drizzle / Neon Postgres）

單人，不需 user 表（OAuth 只守門，不分租戶）。

### `questions` — 一段短文題
| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid PK | |
| `passage` | text | ~70 字短文，含挖空標記 |
| `blanks` | jsonb | 10 個空格陣列：`{ index, shown, answer, hint? }` |
| `topic` | text | 主題/領域 |
| `source` | text | 來源批次/出題日 |
| `createdAt` | timestamp | |

### `attempts` — 一次作答紀錄
| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid PK | |
| `questionId` | uuid FK → questions | |
| `answers` | jsonb | 每格使用者填的字母 + 對錯 |
| `score` | int | 對幾格 |
| `takenAt` | timestamp | |

### `wrongWords` — 錯字本（聚合）
| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid PK | |
| `word` | text unique | 答錯的完整單字 |
| `wrongCount` | int | 累計錯幾次 |
| `lastQuestionId` | uuid FK → questions | 最近出現的題目 |
| `lastWrongAt` | timestamp | |

設計理由：
- `blanks` 用 jsonb 而非另開表——單人、每題固定 ~10 格、不需跨題查個別空格
- `wrongWords` 用 upsert 累加 `wrongCount`
- TS 型別由 Drizzle infer，本地與雲端共用同一份定義

## 5. 出題交接格式（Claude Code → 本地 app 契約）

檔案位置：`questions/<YYYY-MM-DD>-<slug>.json`

```jsonc
{
  "topic": "Marine Biology",
  "source": "2026-06-08-batch1",
  "passage": "Coral reefs are among the most di_____ ecosystems on Earth. They prov___ shelter for thousands of spec___ ...",
  "blanks": [
    { "index": 0, "shown": "di",   "answer": "diverse",  "hint": "varied" },
    { "index": 1, "shown": "prov", "answer": "provide" },
    { "index": 2, "shown": "spec", "answer": "species" }
  ]
}
```

規則：
- `passage` 約 70 字，含 **10 個**挖空；挖空在單字**中間或結尾**
- 挖空在 passage 中以 `shown` + 底線標記呈現（如 `di_____`），渲染時換成輸入框
- `answer` 為完整單字、**美式拼寫**
- `hint` 選填，本地作答模式可開關顯示

載入機制：本地 app 列出 `questions/` 下所有 JSON 當題庫；新題不需重啟 dev server（動態讀取）。所有題目以 zod 驗證 schema。

## 6. 頁面與元件

### 共用元件
- `<CompleteTheWords>` — 渲染「短文 + 挖空輸入框」，本地與雲端共用。props: `question`, `mode`（作答 / 檢視）
- `gradeAttempt(question, answers)` — 純函式批改，比對缺漏字母（大小寫不敏感、trim），回傳每格對錯 + 分數

### 本地路由（`LOCAL_MODE=1`）
- `/` 題庫列表（讀 `questions/*.json`）
- `/practice/[file]` 作答頁 → 交卷 → `gradeAttempt` → 顯示成績 → 背景自動 POST `/api/results`

### 雲端路由（部署版，GitHub OAuth 守門）
- `/review` 重練清單（考過的題，可篩「只看答錯過的」）
- `/review/[id]` 重練單題（同 `<CompleteTheWords>`）
- `/wrong-words` 錯字本（依 `wrongCount` 排序）

### API
- `POST /api/results` — 收本地交卷，Bearer token 驗證；upsert `questions`（避免重複）+ 寫 `attempts` + 更新 `wrongWords`
- 雲端讀取頁走 NextAuth session（GitHub）；非登入導向登入頁

## 7. 錯誤處理

- **上傳失敗**：成績照常顯示；POST 失敗時於成績頁顯示「同步失敗，重試」按鈕，payload 暫存 localStorage，不丟資料
- **JSON 格式錯**：本地載入時 zod 驗證，壞檔在列表標紅、不可進入作答
- **token / auth 錯**：API 回 401；本地顯示明確訊息（檢查 `UPLOAD_TOKEN`）
- **OAuth 非授權帳號**：登入後比對 GitHub login，非本人顯示「無權限」

## 8. 測試

- `gradeAttempt` 純函式 → 單元測試（缺字母、大小寫、多空格部分對）
- zod schema 驗證 → 單元測試（合法 / 壞題目）
- `POST /api/results` upsert → 整合測試（重複題不重複寫、`wrongWords` 累加）
- 出題格式契約 → 一個 fixture JSON 跑通整條本地作答流程

## 9. 環境變數

| 變數 | 用途 | 範圍 |
|------|------|------|
| `LOCAL_MODE` | 開啟本地出題/作答路由 | 本地 |
| `DATABASE_URL` | Neon Postgres 連線（本地不需要，本地只 POST 到雲端 API） | 雲端 |
| `UPLOAD_TOKEN` | `/api/results` Bearer 驗證 | 本地 + 雲端共用 |
| `RESULTS_ENDPOINT` | 本地交卷上傳目標 URL | 本地 |
| `GITHUB_ID` / `GITHUB_SECRET` | NextAuth GitHub OAuth | 雲端 |
| `ALLOWED_GITHUB_LOGIN` | 放行的 GitHub 帳號 | 雲端 |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | NextAuth | 雲端 |
