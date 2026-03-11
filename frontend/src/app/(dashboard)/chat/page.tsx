"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bot, X, FileText, Loader2 } from "lucide-react";
import { useChat } from "@/lib/hooks/useChat";
import ConversationList from "@/components/chat/ConversationList";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import ModelSelector from "@/components/chat/ModelSelector";
import api from "@/lib/api";

interface AttachedFile {
  file: File;
  docId?: string;
  uploading?: boolean;
  name: string;
}

export default function ChatPage() {
  const {
    conversations,
    currentConversation,
    messages,
    isStreaming,
    streamingContent,
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    archiveConversation,
    attachDocument,
    sendMessage,
  } = useChat();

  const [aiModel, setAiModel] = useState("claude");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Reset attached files when switching conversations
  useEffect(() => {
    setAttachedFiles([]);
  }, [currentConversation?.id]);

  const handleNewChat = async () => {
    await createConversation(aiModel);
  };

  const handleSend = async (content: string) => {
    // Upload and attach files before sending
    for (const af of attachedFiles) {
      if (af.docId) {
        await attachDocument(af.docId);
      }
    }
    setAttachedFiles([]);
    sendMessage(content, aiModel);
  };

  const handleSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchConversations(query || undefined);
    }, 300);
  }, [fetchConversations]);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const tempId = `temp-${Date.now()}-${file.name}`;
      const newFile: AttachedFile = { file, name: file.name, uploading: true };
      setAttachedFiles((prev) => [...prev, newFile]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.post("/documents/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && f.uploading
              ? { ...f, docId: res.data.id, uploading: false }
              : f
          )
        );
      } catch (err) {
        console.error("Upload failed:", err);
        setAttachedFiles((prev) => prev.filter((f) => !(f.name === file.name && f.uploading)));
      }
    }

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
        multiple
        onChange={handleFileSelect}
      />

      {/* Conversation sidebar */}
      <ConversationList
        conversations={conversations}
        currentId={currentConversation?.id}
        onSelect={selectConversation}
        onNew={handleNewChat}
        onDelete={deleteConversation}
        onArchive={archiveConversation}
        onSearch={handleSearch}
      />

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex shrink-0 items-center justify-between border-b px-6 h-12">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium text-foreground truncate max-w-md">
              {currentConversation?.title || "Profesor Pajak AI"}
            </h2>
          </div>
          <ModelSelector value={aiModel} onChange={setAiModel} disabled={isStreaming} />
        </div>

        {/* Messages */}
        {currentConversation ? (
          <>
            <div className="flex-1 overflow-y-auto px-6" ref={scrollRef}>
              <div className="mx-auto max-w-4xl py-6">
                {messages.length === 0 && !isStreaming && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                      <Bot className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold">Selamat Datang!</h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Saya adalah Profesor Pajak Indonesia. Silakan tanya tentang PPh, PPN, PPnBM,
                      faktur pajak, bukti potong, atau lampirkan dokumen pajak untuk dianalisis.
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    messageId={msg.id}
                    aiModel={msg.ai_model}
                    files={msg.files}
                  />
                ))}

                {isStreaming && streamingContent && (
                  <ChatMessage
                    role="assistant"
                    content={streamingContent}
                    aiModel={aiModel}
                    isStreaming
                  />
                )}
              </div>
            </div>

            {/* Attached files - above chat input */}
            {attachedFiles.length > 0 && (
              <div className="shrink-0 px-6">
                <div className="mx-auto max-w-4xl flex items-center gap-2 flex-wrap px-2.5 pt-3 pb-1">
                  {attachedFiles.map((af, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground"
                    >
                      {af.uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span className="truncate max-w-40">{af.name}</span>
                      <button
                        onClick={() => handleRemoveFile(i)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <ChatInput
              onSend={handleSend}
              onAttach={handleAttachClick}
              disabled={isStreaming || attachedFiles.some((f) => f.uploading)}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
              <Bot className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold">Chatbot Pajak</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Profesor Perpajakan Indonesia siap membantu Anda. Pilih percakapan yang ada atau mulai chat baru.
            </p>
            <button
              onClick={handleNewChat}
              className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Percakapan Baru
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
