"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, FileText, ScanLine, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/chat", label: "Chat AI", icon: MessageSquare },
  { href: "/documents", label: "Dokumen", icon: FileText },
  { href: "/scanner", label: "Scanner OCR", icon: ScanLine },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          CP
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground">Chatbot Pajak</h1>
          <p className="text-xs text-muted-foreground">Profesor Perpajakan</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.kantor_pajak || user?.email}</p>
          </div>
          <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
