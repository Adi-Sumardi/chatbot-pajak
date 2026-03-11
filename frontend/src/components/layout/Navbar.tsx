"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, ScanLine, Settings, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/chat", label: "Chat AI", icon: MessageSquare },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/admin", label: "Kelola User", icon: Users, adminOnly: true },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Desktop / Tablet Top Navbar */}
      <nav className="hidden sm:block shrink-0 bg-primary">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          {/* Logo + Nav */}
          <div className="flex items-center gap-4 lg:gap-8">
            {/* Logo */}
            <Link href="/chat" className="flex items-center gap-2">
              <Image
                src="/logo/logo-chatbot.png"
                alt="Chatbot Pajak"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-sm font-bold text-white hidden md:block">Chatbot Pajak</span>
            </Link>

            {/* Nav Items */}
            <div className="flex items-center gap-1">
              {visibleItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden lg:block">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white text-[10px] font-bold">
                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-medium text-white">{user?.full_name}</p>
                <p className="text-[9px] text-white/50">
                  {isAdmin
                    ? (user?.role === "superadmin" ? "Super Admin" : "Admin")
                    : (user?.kantor_pajak || user?.email)}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:block">Keluar</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-0 flex-1",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-muted-foreground min-w-0 flex-1"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[10px] font-medium">Keluar</span>
          </button>
        </div>
      </nav>
    </>
  );
}
