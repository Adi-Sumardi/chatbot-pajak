"use client";

import { useEffect, useState, useCallback } from "react";
import { Upload, FileText, Trash2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import api, { API_URL } from "@/lib/api";

interface Document {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  doc_type: string | null;
  extracted_text: string | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  faktur_pajak: "Faktur Pajak",
  bukti_potong: "Bukti Potong",
  rekening_koran: "Rekening Koran",
  spt: "SPT",
  other: "Lainnya",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  faktur_pajak: "bg-blue-100 text-blue-700",
  bukti_potong: "bg-purple-100 text-purple-700",
  rekening_koran: "bg-green-100 text-green-700",
  spt: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const fetchDocuments = useCallback(async () => {
    const params = filter ? { doc_type: filter } : {};
    const res = await api.get("/documents/", { params });
    setDocuments(res.data);
  }, [filter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchDocuments();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus dokumen ini?")) return;
    await api.delete(`/documents/${id}`);
    await fetchDocuments();
  };

  const handlePreview = async (doc: Document) => {
    // Fetch full document detail with extracted_text
    const res = await api.get(`/documents/${doc.id}`);
    setPreviewDoc(res.data);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filters = [null, "faktur_pajak", "bukti_potong", "rekening_koran", "spt", "other"];
  const filterLabels = ["Semua", ...Object.values(DOC_TYPE_LABELS)];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dokumen Saya"
        subtitle="Kelola dokumen pajak Anda"
        actions={
          <Button disabled={uploading} onClick={() => document.getElementById("doc-upload")?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Mengunggah..." : "Unggah Dokumen"}
            <input id="doc-upload" type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" />
          </Button>
        }
      />

      <div className="p-6 space-y-4 flex-1 overflow-auto">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filters.map((f, i) => (
            <button
              key={i}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {filterLabels[i]}
            </button>
          ))}
        </div>

        {/* Document list */}
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Belum ada dokumen</h3>
            <p className="text-sm text-muted-foreground mt-1">Unggah faktur pajak, bukti potong, atau rekening koran</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3 font-medium">Nama File</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Ukuran</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={DOC_TYPE_COLORS[doc.doc_type || "other"]}>
                        {DOC_TYPE_LABELS[doc.doc_type || "other"]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{doc.file_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatSize(doc.file_size)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(doc)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewDoc(null)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">{previewDoc.file_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {DOC_TYPE_LABELS[previewDoc.doc_type || "other"]} - {formatSize(previewDoc.file_size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${API_URL}/api/v1/documents/${previewDoc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={(e) => {
                    e.preventDefault();
                    const token = localStorage.getItem("access_token");
                    window.open(
                      `${API_URL}/api/v1/documents/${previewDoc.id}/file?token=${token}`,
                      "_blank"
                    );
                  }}
                >
                  Buka File
                </a>
                <button onClick={() => setPreviewDoc(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6">
              {previewDoc.extracted_text ? (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Teks yang Diekstrak</h4>
                  <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                    {previewDoc.extracted_text}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {previewDoc.mime_type === "application/pdf"
                      ? "Tidak ada teks yang bisa diekstrak dari PDF ini. Mungkin berupa scan/gambar."
                      : "Preview tidak tersedia untuk tipe file ini."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
