# Chatbot Pajak - Sistem Desain & Implementasi Plan

## Context
Membangun aplikasi Chatbot Pajak profesional untuk kantor pajak Indonesia. Chatbot berperan sebagai Profesor Perpajakan Indonesia yang bisa menganalisis dokumen pajak (faktur pajak, bukti potong, rekening koran) dan memberikan rekapan keuangan klien. Ditambah fitur OCR scan rekening koran PDF ke Excel menggunakan Surya OCR.

---

## Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Frontend** | Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui | SSR, streaming chat support, komponen UI profesional |
| **Backend** | FastAPI (Python 3.11+) | Surya OCR native Python, SDK OpenAI & Claude first-class, async streaming |
| **Database** | PostgreSQL 16 | JSON support, full-text search, robust |
| **AI** | OpenAI SDK + Anthropic SDK + LangChain | Dual model support, conversation memory |
| **OCR** | Surya OCR + img2table | OCR 90+ bahasa termasuk Indonesia, table detection |
| **Export** | openpyxl (Excel) + WeasyPrint (PDF) | Format laporan profesional |
| **Auth** | JWT (PyJWT) | Stateless, scalable |
| **Infra** | Docker Compose | PostgreSQL + Backend + Frontend satu command |

---

## Arsitektur Sistem

```
Browser (Next.js 15)
  |-- Chat Interface (SSE streaming)
  |-- Document Management (upload/view)
  |-- OCR Scanner (upload/process/export)
  |
  v  REST API + SSE
FastAPI Backend
  |-- /api/v1/auth/*        (login, register, JWT)
  |-- /api/v1/chat/*        (conversations, messages, streaming)
  |-- /api/v1/documents/*   (upload, CRUD, text extraction)
  |-- /api/v1/ocr/*         (scan, status, preview, export Excel)
  |-- /api/v1/reports/*     (tax recap, download)
  |
  +-- Services Layer
  |   |-- ai_service.py      (OpenAI + Claude, LangChain)
  |   |-- ocr_service.py     (Surya OCR + img2table)
  |   |-- document_service.py(upload, text extract, classify)
  |   |-- export_service.py  (openpyxl, WeasyPrint)
  |
  +-- Data Layer
      |-- PostgreSQL (users, conversations, messages, documents, ocr_jobs, ocr_results)
      |-- File Storage (uploads/, exports/)
```

---

## UI Design

### Color Scheme (Professional Tax/Government)
- Primary: `#1E3A5F` (navy blue - trust)
- Secondary: `#2D7D9A` (teal)
- Accent: `#D4A843` (gold - prestige)
- Background: `#F8F9FA`, Surface: `#FFFFFF`

### Halaman Utama
1. **Chat** - Chat interface dengan sidebar conversation list, model selector (OpenAI/Claude), attachment dokumen
2. **Dokumen** - Upload & kelola faktur pajak, bukti potong, rekening koran
3. **Scanner OCR** - Upload PDF rekening koran, preview hasil, edit, export Excel
4. **Laporan** - Rekap pajak (PPh 21, PPh 23, PPN, dll), download PDF/Excel
5. **Settings** - Profil user, API keys (admin)

---

## Database Schema (Key Tables)

- **users** - id, email, password_hash, full_name, role, kantor_pajak
- **conversations** - id, user_id, title, ai_model, system_prompt
- **messages** - id, conversation_id, role, content, ai_model, token_usage
- **documents** - id, user_id, file_name, file_path, doc_type, extracted_text, metadata
- **conversation_documents** - conversation_id, document_id (many-to-many)
- **ocr_jobs** - id, user_id, document_id, bank_name, status, progress
- **ocr_results** - id, ocr_job_id, tanggal, keterangan, debit, kredit, saldo, is_corrected
- **exports** - id, user_id, source_type, file_path, file_format

---

## Project Structure

```
Chatbot-Pajak/
+-- frontend/                    # Next.js 15
|   +-- app/
|   |   +-- (auth)/login, register
|   |   +-- (dashboard)/
|   |       +-- chat/[id]/       # Chat interface
|   |       +-- documents/       # Document management
|   |       +-- scanner/[id]/    # OCR scanner + results
|   |       +-- reports/         # Tax recap
|   |       +-- settings/
|   +-- components/
|   |   +-- ui/                  # shadcn/ui
|   |   +-- chat/                # ChatMessage, ChatInput, ModelSelector
|   |   +-- scanner/             # ScannerUpload, ResultsGrid
|   |   +-- layout/              # Sidebar, Header
|   +-- lib/                     # api client, hooks, utils
|
+-- backend/                     # FastAPI
|   +-- app/
|   |   +-- main.py, config.py, database.py
|   |   +-- models/              # SQLAlchemy ORM
|   |   +-- schemas/             # Pydantic schemas
|   |   +-- routers/             # API endpoints
|   |   +-- services/            # Business logic
|   |   +-- prompts/             # AI system prompts (tax_expert.py)
|   |   +-- tasks/               # Background OCR tasks
|   +-- alembic/                 # DB migrations
|   +-- tests/
|
+-- docker-compose.yml
+-- .env.example
```

---

## Fitur Utama

### 1. Chat - Profesor Pajak AI
- System prompt sebagai Profesor Pajak Indonesia (UU HPP, PPh, PPN, e-Faktur)
- Toggle model OpenAI / Claude per conversation
- Streaming response via SSE
- Attach dokumen pajak ke chat untuk analisis
- Auto-generate judul conversation
- History + search

### 2. Document Management
- Upload PDF, gambar, Excel
- Auto-classify (faktur pajak, bukti potong, rekening koran)
- Text extraction otomatis (PyPDF2 digital, Surya OCR scanned)
- Preview in-browser

### 3. OCR Scanner Rekening Koran
- Pilih bank (BCA, Mandiri, BRI, BNI) - template kolom per bank
- Upload PDF -> Surya OCR + img2table extract tabel
- Preview hasil di editable data grid
- User koreksi error OCR
- Export ke Excel (openpyxl) dengan format rapi

### 4. Laporan Rekap Pajak
- Generate dari data dokumen yang di-upload
- Ringkasan PPh 21, PPh 23, PPN, PPnBM
- Export PDF & Excel

---

## Keputusan
- **Deployment:** Cloud VPS (siapkan Docker Compose + Nginx reverse proxy)
- **Auth:** Multi-user dengan role admin & staff (JWT)
- **Prioritas:** Mulai dari Chat AI dulu, lalu dokumen, OCR, reports

---

## Implementasi (Urutan)

### Phase 1 - Foundation (Mulai dari sini)
1. Setup project structure (Next.js + FastAPI + PostgreSQL + Docker Compose)
2. Docker Compose config (postgres, backend, frontend, nginx)
3. Database schema + Alembic migrations
4. JWT authentication (register, login, refresh token)
5. Multi-user dengan role admin & staff
6. Layout dasar (sidebar, header, responsive)

### Phase 2 - Chat AI Core (Prioritas utama)
7. Chat UI - conversation list sidebar + chat area
8. AI service - OpenAI integration (GPT-4o)
9. AI service - Claude integration (Sonnet/Opus)
10. Model selector toggle per conversation
11. Streaming response via SSE
12. System prompt "Profesor Pajak Indonesia"
13. Conversation history, search, archive
14. Auto-generate judul conversation

### Phase 3 - Documents + Chat Context
15. Document upload + file storage
16. Text extraction (PyPDF2 digital, Surya OCR scanned)
17. Auto-classify dokumen (faktur, bukti potong, rekening koran)
18. Attach dokumen ke conversation untuk AI analisis
19. Document management UI (list, preview, delete)

### Phase 4 - OCR Scanner
20. Surya OCR + img2table integration
21. Bank statement scanning pipeline
22. Bank-specific templates (BCA, Mandiri, BRI, BNI)
23. Editable results grid UI
24. Excel export (openpyxl) dengan format rapi
25. Progress indicator real-time

### Phase 5 - Reports, Deploy & Polish
26. Tax recap report generation
27. PDF & Excel export laporan
28. Admin panel (user management)
29. Nginx config + SSL untuk VPS
30. Environment variables + security hardening
31. Testing

---

## Verification
- `docker-compose up` -> semua service jalan
- Register user -> login -> dapat JWT
- Buat conversation -> chat dengan AI -> response streaming
- Upload faktur pajak -> attach ke chat -> AI analisis
- Upload PDF rekening koran -> OCR scan -> preview -> export Excel
- Generate rekap pajak -> download PDF/Excel
