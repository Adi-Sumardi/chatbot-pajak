from collections.abc import AsyncGenerator

import openai
import anthropic

from app.config import get_settings
from app.prompts.tax_expert import TAX_EXPERT_SYSTEM_PROMPT, TITLE_GENERATOR_PROMPT

settings = get_settings()


def _get_openai_client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _get_anthropic_client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def build_messages(
    conversation_messages: list[dict],
    attached_docs_text: str | None = None,
    system_prompt: str | None = None,
) -> tuple[str, list[dict]]:
    """Build system prompt and messages list for AI API calls."""
    system = system_prompt or TAX_EXPERT_SYSTEM_PROMPT

    if attached_docs_text:
        system += f"\n\n## Dokumen yang Dilampirkan:\n{attached_docs_text}"

    messages = [{"role": m["role"], "content": m["content"]} for m in conversation_messages]
    return system, messages


async def stream_openai(
    messages: list[dict],
    system_prompt: str,
    model: str = "gpt-4.1",
) -> AsyncGenerator[str, None]:
    """Stream response from OpenAI."""
    client = _get_openai_client()

    all_messages = [{"role": "system", "content": system_prompt}] + messages

    stream = await client.chat.completions.create(
        model=model,
        messages=all_messages,
        stream=True,
        temperature=0.7,
        max_tokens=4096,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def stream_claude(
    messages: list[dict],
    system_prompt: str,
    model: str = "claude-sonnet-4-6",
) -> AsyncGenerator[str, None]:
    """Stream response from Claude."""
    client = _get_anthropic_client()

    async with client.messages.stream(
        model=model,
        system=system_prompt,
        messages=messages,
        max_tokens=4096,
        temperature=0.7,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def stream_chat(
    messages: list[dict],
    system_prompt: str,
    ai_model: str = "openai",
) -> AsyncGenerator[str, None]:
    """Route to the correct AI provider and stream response."""
    if ai_model == "claude":
        async for chunk in stream_claude(messages, system_prompt):
            yield chunk
    else:
        async for chunk in stream_openai(messages, system_prompt):
            yield chunk


async def generate_title(message: str, ai_model: str = "openai") -> str:
    """Generate a short conversation title from the first message."""
    prompt = TITLE_GENERATOR_PROMPT.format(message=message)

    try:
        if ai_model == "claude":
            client = _get_anthropic_client()
            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                system="Kamu adalah asisten yang membuat judul singkat.",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50,
            )
            return response.content[0].text.strip()
        else:
            client = _get_openai_client()
            response = await client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": "Kamu adalah asisten yang membuat judul singkat."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=50,
            )
            return response.choices[0].message.content.strip()
    except Exception:
        return message[:50] + "..." if len(message) > 50 else message
