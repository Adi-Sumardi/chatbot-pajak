"use client";

import { useState, useCallback } from "react";
import api, { API_URL } from "@/lib/api";

export interface FileAttachment {
  format: "excel" | "pdf";
  message_id: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ai_model?: string;
  files?: FileAttachment[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  ai_model: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface DocumentInfo {
  id: string;
  file_name: string;
  doc_type: string;
  file_size: number;
  mime_type: string;
  extracted_text: string | null;
  created_at: string;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const fetchConversations = useCallback(async (search?: string) => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    const res = await api.get("/chat/conversations", { params });
    setConversations(res.data);
  }, []);

  const createConversation = useCallback(async (aiModel: string = "claude") => {
    const res = await api.post("/chat/conversations", { ai_model: aiModel });
    setCurrentConversation(res.data);
    setMessages([]);
    await fetchConversations();
    return res.data;
  }, [fetchConversations]);

  const selectConversation = useCallback(async (id: string) => {
    const res = await api.get(`/chat/conversations/${id}`);
    setCurrentConversation(res.data);
    setMessages(res.data.messages || []);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await api.delete(`/chat/conversations/${id}`);
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setMessages([]);
    }
    await fetchConversations();
  }, [currentConversation, fetchConversations]);

  const archiveConversation = useCallback(async (id: string) => {
    await api.patch(`/chat/conversations/${id}`, { is_archived: true });
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setMessages([]);
    }
    await fetchConversations();
  }, [currentConversation, fetchConversations]);

  const attachDocument = useCallback(async (documentId: string) => {
    if (!currentConversation) return;
    await api.post(`/chat/conversations/${currentConversation.id}/attach`, {
      document_id: documentId,
    });
  }, [currentConversation]);

  const sendMessage = useCallback(async (content: string, aiModel?: string) => {
    if (!currentConversation || isStreaming) return;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${API_URL}/api/v1/chat/conversations/${currentConversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content, ai_model: aiModel }),
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let fullContent = "";
      let generatedFiles: FileAttachment[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            if (data.startsWith("[ERROR]")) {
              throw new Error(data.slice(8));
            }
            try {
              const parsed = JSON.parse(data);
              // Check if this is a file event
              if (parsed && typeof parsed === "object" && parsed.type === "files") {
                generatedFiles = parsed.files || [];
              } else if (typeof parsed === "string") {
                fullContent += parsed;
                setStreamingContent(fullContent);
              } else {
                fullContent += data;
                setStreamingContent(fullContent);
              }
            } catch {
              fullContent += data;
              setStreamingContent(fullContent);
            }
          }
        }
      }

      const assistantMsg: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: fullContent,
        ai_model: aiModel || currentConversation.ai_model,
        files: generatedFiles.length > 0 ? generatedFiles : undefined,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");

      await fetchConversations();
    } catch (error) {
      console.error("Chat error:", error);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
    }
  }, [currentConversation, isStreaming, fetchConversations]);

  return {
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
  };
}
