"""LLM-based structuring for bank statement OCR — fallback when heuristic quality is low."""

import asyncio
import json
import logging
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import pdfplumber
import anthropic
import openai

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Chunking config
CHUNK_SIZE_PAGES = 5       # Pages per LLM call
MAX_CHARS_PER_CHUNK = 10_000  # ~2500 tokens input per chunk
MAX_PARALLEL_CALLS = 3    # Max concurrent LLM calls (rate-limit safe)

# Quality thresholds — if below either, trigger LLM
QUALITY_FILL_RATE = 0.60  # 60% of rows must have date + amount
QUALITY_MIN_ROWS = 10     # At least 10 rows for a valid statement


def check_extraction_quality(results: list[dict]) -> tuple[float, int]:
    """
    Return (fill_rate, total_rows).
    fill_rate = fraction of rows that have both tanggal AND (debit OR kredit OR saldo).
    """
    if not results:
        return 0.0, 0
    good = sum(
        1 for r in results
        if r.get("tanggal") and (r.get("debit") or r.get("kredit") or r.get("saldo"))
    )
    return good / len(results), len(results)


def _extract_pages_text(file_path: str) -> list[str]:
    """Extract raw text string from each PDF page (sync, call via to_thread)."""
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)
    return pages


def _parse_date_str(s) -> date | None:
    """Parse LLM date output ('DD/MM/YYYY' or variants) to date object."""
    if not s:
        return None
    s = str(s).strip()
    m = re.match(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})", s)
    if m:
        try:
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if y < 100:
                y += 2000
            return date(y, mo, d)
        except ValueError:
            pass
    return None


def _to_decimal(val) -> Decimal | None:
    """Convert LLM number output to Decimal."""
    if val is None:
        return None
    try:
        d = Decimal(str(val))
        return d if d != 0 else None
    except (InvalidOperation, TypeError):
        return None


def _parse_llm_json(raw: str) -> list[dict]:
    """Extract JSON array from LLM response, handle markdown code blocks."""
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []
    try:
        return json.loads(match.group())
    except json.JSONDecodeError as e:
        logger.warning(f"LLM JSON decode error: {e} — raw snippet: {raw[:200]}")
        return []


def _convert_llm_rows(raw_rows: list) -> list[dict]:
    """Convert raw LLM JSON rows to our internal dict format with proper types."""
    results = []
    for i, row in enumerate(raw_rows):
        if not isinstance(row, dict):
            continue
        tanggal = _parse_date_str(row.get("tanggal"))
        keterangan = str(row.get("keterangan") or "").strip() or None
        debit = _to_decimal(row.get("debit"))
        kredit = _to_decimal(row.get("kredit"))
        saldo = _to_decimal(row.get("saldo"))

        if not any([tanggal, keterangan, debit, kredit, saldo]):
            continue

        results.append({
            "row_number": i + 1,
            "tanggal": tanggal,
            "keterangan": keterangan,
            "debit": debit,
            "kredit": kredit,
            "saldo": saldo,
            "raw_text": json.dumps(row, ensure_ascii=False),
        })
    return results


def _build_prompt(text: str, bank_name: str | None, chunk_info: str) -> str:
    bank_label = (bank_name or "").upper() or "Unknown"
    return (
        f"Berikut adalah hasil ekstraksi teks dari rekening koran Bank {bank_label} ({chunk_info}).\n"
        "Teks mungkin tidak rapi karena proses ekstraksi PDF.\n\n"
        "TEKS:\n"
        "---\n"
        f"{text}\n"
        "---\n\n"
        "Strukturkan semua transaksi menjadi JSON array. Setiap objek memiliki field:\n"
        '- "tanggal": "DD/MM/YYYY" atau null\n'
        '- "keterangan": string deskripsi transaksi\n'
        '- "debit": number atau null (uang keluar)\n'
        '- "kredit": number atau null (uang masuk)\n'
        '- "saldo": number atau null (saldo akhir)\n\n'
        "Aturan penting:\n"
        "- Angka sebagai number JavaScript (1500000 bukan \"1.500.000\")\n"
        "- Abaikan header, footer, nomor halaman, baris total/ringkasan\n"
        "- Gabungkan baris keterangan lanjutan ke transaksi sebelumnya\n"
        "- Koreksi tanggal jika format tidak standar\n"
        "- Kembalikan HANYA JSON array, tanpa penjelasan apapun"
    )


async def _call_claude(prompt: str) -> str:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


async def _call_openai(prompt: str) -> str:
    client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.chat.completions.create(
        model="gpt-4.1-mini",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content


async def _process_one_chunk(
    chunk_text: str,
    bank_name: str | None,
    chunk_info: str,
    ai_model: str,
    semaphore: asyncio.Semaphore,
) -> list[dict]:
    """Send one text chunk to LLM, with automatic fallback to the other provider."""
    async with semaphore:
        prompt = _build_prompt(chunk_text, bank_name, chunk_info)
        try:
            if ai_model == "claude":
                raw = await _call_claude(prompt)
            else:
                raw = await _call_openai(prompt)
            rows = _parse_llm_json(raw)
            if rows:
                return _convert_llm_rows(rows)
            raise ValueError("Empty or unparseable response")
        except Exception as e:
            logger.warning(f"Primary LLM failed ({chunk_info}): {e}. Trying fallback provider...")
            try:
                if ai_model == "claude":
                    raw = await _call_openai(prompt)
                else:
                    raw = await _call_claude(prompt)
                rows = _parse_llm_json(raw)
                return _convert_llm_rows(rows) if rows else []
            except Exception as e2:
                logger.error(f"Both LLM providers failed ({chunk_info}): {e2}")
                return []


async def structure_with_llm(
    file_path: str,
    bank_name: str | None = None,
    year: int | None = None,
    ai_model: str = "claude",
) -> list[dict]:
    """
    Extract and structure a bank statement PDF using LLM.

    Strategy for large documents (50+ pages):
    - Extracts raw text per page
    - Groups into chunks of CHUNK_SIZE_PAGES pages
    - Processes chunks in parallel (max MAX_PARALLEL_CALLS concurrent)
    - Merges and sorts all results by date
    """
    pages_text = await asyncio.to_thread(_extract_pages_text, file_path)
    total_pages = len(pages_text)
    logger.info(f"LLM OCR: processing {total_pages} pages, bank={bank_name}, model={ai_model}")

    # Build chunks — skip blank pages, truncate oversized text
    chunks: list[tuple[str, str]] = []
    for i in range(0, total_pages, CHUNK_SIZE_PAGES):
        page_slice = pages_text[i:i + CHUNK_SIZE_PAGES]
        parts = [
            f"[Halaman {i + j + 1}]\n{text}"
            for j, text in enumerate(page_slice)
            if text.strip()
        ]
        if not parts:
            continue
        combined = "\n\n--- Halaman Baru ---\n\n".join(parts)
        if len(combined) > MAX_CHARS_PER_CHUNK:
            combined = combined[:MAX_CHARS_PER_CHUNK]
        end_page = min(i + CHUNK_SIZE_PAGES, total_pages)
        chunks.append((combined, f"halaman {i + 1}–{end_page}"))

    if not chunks:
        logger.warning("LLM OCR: no text found in PDF pages")
        return []

    logger.info(f"LLM OCR: {len(chunks)} chunk(s) → {MAX_PARALLEL_CALLS} parallel max")

    semaphore = asyncio.Semaphore(MAX_PARALLEL_CALLS)
    tasks = [
        _process_one_chunk(text, bank_name, info, ai_model, semaphore)
        for text, info in chunks
    ]
    chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge all rows
    all_rows: list[dict] = []
    for res in chunk_results:
        if isinstance(res, list):
            all_rows.extend(res)
        elif isinstance(res, Exception):
            logger.error(f"Chunk task raised exception: {res}")

    # Sort by date (None → end), then re-number sequentially
    all_rows.sort(key=lambda r: (r["tanggal"] is None, r["tanggal"] or date.min))
    for idx, row in enumerate(all_rows, 1):
        row["row_number"] = idx

    logger.info(f"LLM OCR: extracted {len(all_rows)} transactions from {total_pages} pages")
    return all_rows