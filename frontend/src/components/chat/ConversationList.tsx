"use client";

import { useState } from "react";
import { MessageSquare, Plus, Trash2, Archive, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/hooks/useChat";

interface ConversationListProps {
  conversations: Conversation[];
  currentId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onSearch?: (query: string) => void;
  open?: boolean;
  onClose?: () => void;
}

export default function ConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onArchive,
  onSearch,
  open,
  onClose,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  const handleNew = () => {
    onNew();
    onClose?.();
  };

  const sidebarContent = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b px-4 h-12">
        <h3 className="text-sm font-semibold">Percakapan</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleNew} className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:hidden">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Cari percakapan..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? "Tidak ditemukan." : "Belum ada percakapan."}
              <br />
              {!searchQuery && "Mulai chat baru!"}
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                  conv.id === currentId
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
                onClick={() => handleSelect(conv.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{conv.title || "Percakapan Baru"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(conv.updated_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  {onArchive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(conv.id);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground"
                      title="Arsipkan"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(conv);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive"
                    title="Hapus"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Percakapan</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus percakapan &quot;{deleteTarget?.title || "Percakapan Baru"}&quot;? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Batal
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className="hidden sm:flex h-full w-72 flex-col border-r bg-card overflow-hidden">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] flex flex-col bg-card shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
