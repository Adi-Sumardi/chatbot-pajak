"use client";

import { BarChart3 } from "lucide-react";
import Header from "@/components/layout/Header";

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Laporan Rekap Pajak" subtitle="Generate rekap pajak bulanan dan tahunan" />
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-8">
        <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Coming Soon</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Fitur laporan rekap pajak sedang dalam pengembangan. Anda akan bisa menggenerate
          rekapitulasi PPh 21, PPh 23, PPN, dan lainnya dari dokumen yang sudah diunggah.
        </p>
      </div>
    </div>
  );
}
