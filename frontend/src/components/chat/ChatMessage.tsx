"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Download, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";
import type { FileAttachment } from "@/lib/hooks/useChat";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  messageId?: string;
  aiModel?: string;
  files?: FileAttachment[];
  isStreaming?: boolean;
}

const FILE_CONFIG = {
  excel: {
    icon: FileSpreadsheet,
    label: "Download Excel",
    color: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
    iconColor: "text-green-600",
  },
  pdf: {
    icon: FileText,
    label: "Download PDF",
    color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    iconColor: "text-red-600",
  },
};

export default function ChatMessage({ role, content, messageId, aiModel, files, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  const handleDownload = (format: "excel" | "pdf", msgId?: string) => {
    const id = msgId || messageId;
    if (!id || id.startsWith("temp-")) return;
    const token = localStorage.getItem("access_token");
    window.open(
      `${API_URL}/api/v1/chat/messages/${id}/export?format=${format}&token=${token}`,
      "_blank"
    );
  };

  return (
    <div
      className={cn(
        "flex gap-2.5 sm:gap-4 py-3 sm:py-5 transition-all duration-300 ease-out",
        isUser ? "flex-row-reverse" : ""
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full shadow-sm",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-linear-to-br from-primary to-primary/80 text-primary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 space-y-1.5 min-w-0", isUser ? "text-right" : "")}>
        <div className={cn("flex items-center gap-2", isUser ? "justify-end" : "")}>
          <span className="text-xs font-semibold text-foreground/70">
            {isUser ? "Anda" : "Profesor Pajak"}
          </span>
          {aiModel && !isUser && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {aiModel === "claude" ? "Claude" : "OpenAI"}
            </span>
          )}
        </div>
        <div
          className={cn(
            "inline-block rounded-2xl text-[13px] sm:text-[14px] leading-[1.75] max-w-[95%] sm:max-w-[88%] text-left",
            isUser
              ? "bg-primary text-primary-foreground px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-br-md shadow-sm"
              : "bg-muted/60 text-foreground px-3.5 sm:px-5 py-3 sm:py-4 rounded-bl-md border border-border/40"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <div
              className={cn(
                "prose prose-sm max-w-none",
                "prose-p:my-2.5 prose-p:leading-[1.8]",
                "prose-headings:font-semibold prose-headings:text-foreground",
                "prose-h1:text-lg prose-h1:mt-6 prose-h1:mb-3",
                "prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2.5",
                "prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2",
                "prose-ul:my-3 prose-ul:space-y-1.5",
                "prose-ol:my-3 prose-ol:space-y-1.5",
                "prose-li:my-0 prose-li:leading-[1.7]",
                "prose-strong:text-foreground prose-strong:font-semibold",
                "prose-code:text-primary prose-code:bg-primary/5 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
                "prose-pre:bg-foreground/5 prose-pre:text-foreground prose-pre:rounded-xl prose-pre:border prose-pre:border-border/50 prose-pre:my-4",
                "prose-blockquote:border-l-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic",
                "prose-table:my-4 prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-border",
                "prose-hr:my-6 prose-hr:border-border/60",
                "prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
          {isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-primary/60 rounded-full ml-1 align-middle" />
          )}

          {/* Export buttons - shown when files are available */}
          {files && files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/30">
              {files.map((file, i) => {
                const config = FILE_CONFIG[file.format];
                const Icon = config.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleDownload(file.format, file.message_id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      config.color
                    )}
                  >
                    <Icon className={cn("h-4 w-4", config.iconColor)} />
                    <span>{config.label}</span>
                    <Download className="h-3 w-3 ml-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
