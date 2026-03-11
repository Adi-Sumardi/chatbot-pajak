"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  onAttach?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, onAttach, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [message]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t bg-card/80 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-5">
      <div className="mx-auto flex max-w-3xl items-end gap-1.5 rounded-2xl border border-border/60 bg-background px-2 sm:px-3 py-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
          disabled={disabled || !onAttach}
          onClick={onAttach}
          title="Lampirkan file"
        >
          <Paperclip className="h-4.5 w-4.5" />
        </button>
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ketik pertanyaan pajak Anda..."}
          className="min-h-9 max-h-50 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm py-2"
          rows={1}
          disabled={disabled}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="shrink-0 h-9 w-9 rounded-xl"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="hidden sm:block mt-2.5 text-center text-xs text-muted-foreground">
        Tekan Enter untuk kirim, Shift+Enter untuk baris baru
      </p>
    </div>
  );
}
