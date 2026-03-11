"use client";

import { useState } from "react";
import {
  User,
  Lock,
  Building2,
  Mail,
  Shield,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  // Profile form
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [kantorPajak, setKantorPajak] = useState(user?.kantor_pajak || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await api.patch("/auth/me", {
        full_name: fullName,
        kantor_pajak: kantorPajak || null,
      });
      if (refreshUser) await refreshUser();
      setProfileMsg({ type: "success", text: "Profil berhasil diperbarui." });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setProfileMsg({ type: "error", text: axiosErr.response?.data?.detail || "Gagal menyimpan profil." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password baru minimal 6 karakter." });
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post("/auth/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "success", text: "Password berhasil diubah." });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setPasswordMsg({ type: "error", text: axiosErr.response?.data?.detail || "Gagal mengubah password." });
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center border-b bg-card px-6 h-14">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pengaturan</h2>
          <p className="text-xs text-muted-foreground">Kelola profil dan keamanan akun Anda</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-6 space-y-6">

          {/* Profile Card */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b bg-muted/30">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Informasi Profil</h3>
                <p className="text-xs text-muted-foreground">Perbarui nama dan informasi kantor Anda</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Avatar + Info summary */}
              <div className="flex items-center gap-4 pb-4 border-b border-border/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                  {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.full_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {user?.email}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      {user?.role === "admin" ? "Administrator" : "Staff"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nama Lengkap</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Kantor Pajak</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={kantorPajak}
                      onChange={(e) => setKantorPajak(e.target.value)}
                      placeholder="Contoh: KPP Pratama Jakarta Selatan"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={user?.email || ""} readOnly className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Bergabung Sejak</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={formatDate((user as Record<string, string>)?.created_at)}
                      readOnly
                      className="bg-muted/50 cursor-not-allowed pl-9"
                    />
                  </div>
                </div>
              </div>

              {profileMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  profileMsg.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {profileMsg.type === "success"
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                  {profileMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleProfileSave}
                  disabled={profileSaving || !fullName.trim()}
                >
                  {profileSaving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  Simpan Profil
                </Button>
              </div>
            </div>
          </div>

          {/* Password Card */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b bg-muted/30">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Ubah Password</h3>
                <p className="text-xs text-muted-foreground">Pastikan password baru minimal 6 karakter</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Password Saat Ini</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Password Baru</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Konfirmasi Password Baru</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                  />
                </div>
              </div>

              {passwordMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  passwordMsg.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {passwordMsg.type === "success"
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                  {passwordMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePasswordChange}
                  disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                >
                  {passwordSaving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  Ubah Password
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
