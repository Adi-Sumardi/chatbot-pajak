"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ScanLine,
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";
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
import api, { API_URL } from "@/lib/api";

interface OCRJob {
  id: string;
  bank_name: string | null;
  status: string;
  error_message: string | null;
  total_pages: number | null;
  processed_pages: number;
  created_at: string;
  completed_at: string | null;
}

interface OCRResult {
  id: string;
  row_number: number | null;
  tanggal: string | null;
  keterangan: string | null;
  debit: number | string | null;
  kredit: number | string | null;
  saldo: number | string | null;
  is_corrected: boolean;
}

const BANK_LABELS: Record<string, string> = {
  bca: "BCA",
  mandiri: "Mandiri",
  bri: "BRI",
  bni: "BNI",
  cimb: "CIMB Niaga",
  bsi: "BSI",
  danamon: "Danamon",
  permata: "Permata",
  ocbc: "OCBC NISP",
  mega: "Bank Mega",
  other: "Lainnya",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-green-600", label: "Selesai" },
  processing: { icon: Loader2, color: "text-blue-600", label: "Memproses..." },
  queued: { icon: Clock, color: "text-yellow-600", label: "Antrian" },
  failed: { icon: AlertCircle, color: "text-red-600", label: "Gagal" },
};

export default function ScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [jobs, setJobs] = useState<OCRJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<OCRJob | null>(null);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OCRJob | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get("/ocr/jobs");
      setJobs(res.data);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setScanError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/ocr/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setFile(null);
      await fetchJobs();
      // Auto-select the new job
      handleSelectJob(res.data);
    } catch (err: unknown) {
      console.error("Scan failed:", err);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setScanError(axiosErr.response?.data?.detail || "Gagal memproses file. Silakan coba lagi.");
    } finally {
      setScanning(false);
    }
  };

  const handleSelectJob = async (job: OCRJob) => {
    setSelectedJob(job);
    if (job.status === "completed") {
      setLoadingResults(true);
      try {
        const res = await api.get(`/ocr/jobs/${job.id}/results`);
        setResults(res.data);
      } catch (err) {
        console.error("Failed to fetch results:", err);
        setResults([]);
      } finally {
        setLoadingResults(false);
      }
    } else {
      setResults([]);
    }
  };

  const handleExport = async (jobId: string) => {
    const token = localStorage.getItem("access_token");
    window.open(`${API_URL}/api/v1/ocr/jobs/${jobId}/export?token=${token}`, "_blank");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/ocr/jobs/${deleteTarget.id}`);
      if (selectedJob?.id === deleteTarget.id) {
        setSelectedJob(null);
        setResults([]);
      }
      await fetchJobs();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteTarget(null);
  };

  const toNum = (val: number | string | null | undefined): number | null => {
    if (val === null || val === undefined) return null;
    const n = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(n) ? null : n;
  };

  const formatMoney = (val: number | string | null) => {
    const n = toNum(val);
    if (n === null) return "-";
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const totalDebit = results.reduce((sum, r) => sum + (toNum(r.debit) || 0), 0);
  const totalKredit = results.reduce((sum, r) => sum + (toNum(r.kredit) || 0), 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6 h-14">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">Scanner Rekening Koran</h2>
          <p className="text-xs text-muted-foreground truncate">Scan PDF rekening koran ke Excel dengan OCR</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
        {/* Left panel - Upload + Job List */}
        <div className="sm:w-80 shrink-0 border-b sm:border-b-0 sm:border-r flex flex-col overflow-hidden bg-card max-h-[40vh] sm:max-h-none">
          {/* Upload section */}
          <div className="shrink-0 p-4 border-b space-y-3">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : file
                    ? "border-primary/40 bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/40"
              }`}
              onClick={() => !file && document.getElementById("ocr-upload")?.click()}
            >
              {file ? (
                <div className="flex items-center gap-3 w-full">
                  <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="shrink-0 p-1 rounded-full hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs font-medium">Drop PDF atau klik</p>
                  <p className="text-[11px] text-muted-foreground">Maks {50}MB</p>
                </>
              )}
              <input
                id="ocr-upload"
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
              />
            </div>

            <Button
              className="w-full h-9 text-sm"
              disabled={!file || scanning}
              onClick={handleScan}
            >
              {scanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <ScanLine className="h-3.5 w-3.5 mr-2" />
                  Mulai Scan
                </>
              )}
            </Button>

            {scanError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Riwayat Scan</p>
            </div>
            {jobs.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Belum ada riwayat scan.
              </p>
            ) : (
              <div className="space-y-0.5 px-2 pb-2">
                {jobs.map((job) => {
                  const StatusIcon = STATUS_CONFIG[job.status]?.icon || Clock;
                  const statusColor = STATUS_CONFIG[job.status]?.color || "text-muted-foreground";
                  const isSelected = selectedJob?.id === job.id;

                  return (
                    <div
                      key={job.id}
                      onClick={() => handleSelectJob(job)}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <StatusIcon className={`h-4 w-4 shrink-0 ${statusColor} ${job.status === "processing" ? "animate-spin" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {BANK_LABELS[job.bank_name || "other"]}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(job); }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/40 ${isSelected ? "text-primary" : ""}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedJob ? (
            <>
              {/* Results header */}
              <div className="shrink-0 flex items-center justify-between border-b px-4 sm:px-6 py-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Hasil Scan - {BANK_LABELS[selectedJob.bank_name || "other"]}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedJob.status === "completed"
                      ? `${results.length} transaksi ditemukan`
                      : STATUS_CONFIG[selectedJob.status]?.label || selectedJob.status}
                  </p>
                </div>
                {selectedJob.status === "completed" && results.length > 0 && (
                  <Button size="sm" onClick={() => handleExport(selectedJob.id)}>
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Export Excel
                  </Button>
                )}
              </div>

              {/* Results table */}
              {loadingResults ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : selectedJob.status === "failed" ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                  <h3 className="text-sm font-semibold text-red-600">Scan Gagal</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    {selectedJob.error_message || "Terjadi kesalahan saat memproses PDF."}
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <ScanLine className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {selectedJob.status === "completed"
                      ? "Tidak ada transaksi yang terdeteksi"
                      : "Sedang memproses..."}
                  </h3>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-medium w-12">No</th>
                        <th className="px-4 py-2.5 text-left font-medium w-28">Tanggal</th>
                        <th className="px-4 py-2.5 text-left font-medium">Keterangan</th>
                        <th className="px-4 py-2.5 text-right font-medium w-36">Debit</th>
                        <th className="px-4 py-2.5 text-right font-medium w-36">Kredit</th>
                        <th className="px-4 py-2.5 text-right font-medium w-36">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => (
                        <tr
                          key={row.id}
                          className={`border-b border-border/40 hover:bg-muted/30 ${
                            row.is_corrected ? "bg-yellow-50/50" : ""
                          }`}
                        >
                          <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2">{formatDate(row.tanggal)}</td>
                          <td className="px-4 py-2 max-w-xs truncate" title={row.keterangan || ""}>
                            {row.keterangan || "-"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-red-600">
                            {row.debit ? formatMoney(row.debit) : "-"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-green-600">
                            {row.kredit ? formatMoney(row.kredit) : "-"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {row.saldo ? formatMoney(row.saldo) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-card border-t-2">
                      <tr className="text-sm font-semibold">
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">
                          {formatMoney(totalDebit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">
                          {formatMoney(totalKredit)}
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <ScanLine className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">Scanner OCR</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Upload PDF rekening koran dari bank Anda. Sistem akan mengekstrak data transaksi
                secara otomatis dan bisa diekspor ke Excel.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {Object.entries(BANK_LABELS).filter(([k]) => k !== "other").map(([key, label]) => (
                  <span
                    key={key}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Riwayat Scan</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus scan ini? Data hasil ekstraksi juga akan dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Batal
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirm}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
