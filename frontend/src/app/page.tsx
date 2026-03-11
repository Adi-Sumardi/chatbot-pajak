import Link from "next/link";
import {
  MessageSquare,
  ScanLine,
  FileText,
  BarChart3,
  Shield,
  Zap,
  Bot,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Calculator,
  Building2,
  Phone,
} from "lucide-react";

const WA_LINK =
  "https://wa.me/6285121379697?text=Halo%2C%20saya%20ingin%20mendaftar%20akun%20Chatbot%20Pajak";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              CP
            </div>
            <span className="text-lg font-bold text-foreground">Chatbot Pajak</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Masuk
            </Link>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              Hubungi Kami
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-40 left-1/4 h-[400px] w-[400px] rounded-full bg-secondary/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm">
              <Zap className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">Didukung AI Claude & OpenAI</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Profesor Pajak{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                AI Indonesia
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Asisten AI cerdas untuk konsultasi perpajakan Indonesia. Analisis faktur pajak,
              bukti potong, rekening koran, dan dapatkan rekapitulasi keuangan instan.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 rounded-xl bg-green-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-green-600/25 transition-all hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/30"
              >
                <Phone className="h-4 w-4" />
                Hubungi untuk Mendaftar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-xl border bg-card px-8 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Sudah Punya Akun
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-green-600" />
                Data Terenkripsi
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Sesuai Regulasi DJP
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-green-600" />
                Respons Real-time
              </div>
            </div>
          </div>

          {/* Hero Preview */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center text-xs text-muted-foreground">Chatbot Pajak - Profesor Perpajakan Indonesia</div>
              </div>
              {/* Chat preview */}
              <div className="p-6 space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground max-w-[70%]">
                    Tolong hitung PPh 21 untuk karyawan dengan gaji Rp 15.000.000/bulan, status K/1
                  </div>
                </div>
                {/* AI response */}
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-xl bg-muted px-4 py-3 text-sm max-w-[80%] space-y-2">
                    <p className="font-semibold">Perhitungan PPh 21 - Status K/1:</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Gaji Bruto: Rp 15.000.000/bulan</p>
                      <p>Biaya Jabatan (5%): Rp 500.000 (maks)</p>
                      <p>PTKP K/1: Rp 63.000.000/tahun</p>
                      <p>PKP: Rp 117.000.000/tahun</p>
                      <p className="font-medium text-foreground">PPh 21 Terutang: Rp 11.550.000/tahun (Rp 962.500/bulan)</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Dasar hukum: UU HPP No. 7/2021, PP 58/2023</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-card py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Fitur Lengkap untuk Profesional Pajak
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Dirancang khusus untuk membantu kantor pajak dan konsultan pajak
              dalam mengelola dan menganalisis data perpajakan klien.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MessageSquare,
                title: "Chat AI Pajak",
                description: "Konsultasi langsung dengan AI yang memahami PPh, PPN, PPnBM, dan seluruh regulasi perpajakan Indonesia.",
                color: "bg-blue-50 text-blue-600",
              },
              {
                icon: ScanLine,
                title: "Scanner OCR",
                description: "Scan rekening koran PDF dan konversi otomatis ke Excel. Mendukung BCA, Mandiri, BRI, BNI.",
                color: "bg-green-50 text-green-600",
              },
              {
                icon: FileText,
                title: "Analisis Dokumen",
                description: "Upload faktur pajak, bukti potong, SPT, dan dokumen lainnya untuk dianalisis secara otomatis oleh AI.",
                color: "bg-purple-50 text-purple-600",
              },
              {
                icon: BarChart3,
                title: "Export Laporan",
                description: "Generate laporan pajak dan keuangan langsung dari chat. Export ke PDF dan Excel dengan format profesional.",
                color: "bg-orange-50 text-orange-600",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border bg-background p-6 transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Knowledge Section */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                Menguasai Seluruh Regulasi Perpajakan Indonesia
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                AI kami telah dilatih dengan pemahaman mendalam tentang peraturan perpajakan Indonesia
                yang berlaku, termasuk perubahan terbaru dari UU HPP.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { icon: Calculator, text: "PPh 21, 22, 23, 25/29, 26, 4(2) - Perhitungan & Pelaporan" },
                  { icon: BookOpen, text: "UU HPP No. 7/2021, UU PPh, UU PPN & PPnBM" },
                  { icon: FileText, text: "e-Faktur, e-Bupot, e-Filing, e-Billing" },
                  { icon: Building2, text: "PP, PMK, dan SE Dirjen Pajak Terkini" },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-foreground pt-1.5">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { number: "50+", label: "Jenis Perhitungan Pajak", sub: "PPh, PPN, PPnBM" },
                { number: "24/7", label: "Tersedia Kapan Saja", sub: "AI tidak pernah istirahat" },
                { number: "< 3s", label: "Respons Instan", sub: "Streaming real-time" },
                { number: "100%", label: "Bahasa Indonesia", sub: "Sesuai konteks lokal" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border bg-card p-6 text-center transition-all hover:shadow-md"
                >
                  <p className="text-3xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {stat.number}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{stat.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-card py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Cara Kerja
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Tiga langkah mudah untuk memulai
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Hubungi Admin",
                description: "Hubungi kami via WhatsApp untuk mendapatkan akun. Tim kami akan membuatkan akun untuk Anda.",
              },
              {
                step: "02",
                title: "Upload Dokumen",
                description: "Unggah faktur pajak, bukti potong, atau rekening koran. AI akan mengekstrak datanya secara otomatis.",
              },
              {
                step: "03",
                title: "Tanya & Analisis",
                description: "Tanyakan apapun tentang perpajakan atau minta AI menganalisis dokumen Anda. Dapatkan jawaban instan.",
              },
            ].map((item) => (
              <div key={item.step} className="relative rounded-2xl border bg-background p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <span className="text-xl font-extrabold text-primary">{item.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center sm:px-16">
            {/* BG decoration */}
            <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
                Siap Meningkatkan Efisiensi Kerja Pajak Anda?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
                Hubungi kami sekarang untuk mendapatkan akun dan rasakan kemudahan konsultasi perpajakan dengan AI.
              </p>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-green-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-green-600 hover:shadow-xl"
              >
                <Phone className="h-4 w-4" />
                Hubungi via WhatsApp
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                CP
              </div>
              <div>
                <span className="text-sm font-bold text-foreground">Chatbot Pajak</span>
                <p className="text-xs text-muted-foreground">Profesor Perpajakan Indonesia</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Chatbot Pajak. Didukung oleh AI Claude & OpenAI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
