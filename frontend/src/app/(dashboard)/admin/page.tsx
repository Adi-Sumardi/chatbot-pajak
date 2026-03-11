"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  MessageSquare,
  ScanLine,
  Shield,
  ShieldCheck,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  kantor_pajak: string | null;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  total_users: number;
  active_users: number;
  total_conversations: number;
  total_scans: number;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  superadmin: { label: "Super Admin", color: "bg-amber-100 text-amber-800", icon: ShieldCheck },
  admin: { label: "Admin", color: "bg-blue-100 text-blue-800", icon: ShieldCheck },
  staff: { label: "Staff", color: "bg-gray-100 text-gray-700", icon: Shield },
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "staff",
    kantor_pajak: "",
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      router.push("/chat");
    }
  }, [isAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/stats"),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ email: "", full_name: "", password: "", role: "staff", kantor_pajak: "" });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setFormData({
      email: u.email,
      full_name: u.full_name,
      password: "",
      role: u.role,
      kantor_pajak: u.kantor_pajak || "",
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormSaving(true);
    setFormError(null);
    try {
      if (editingUser) {
        const payload: Record<string, string | boolean | null> = {
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          kantor_pajak: formData.kantor_pajak || null,
        };
        if (formData.password) payload.password = formData.password;
        await api.patch(`/admin/users/${editingUser.id}`, payload);
      } else {
        if (!formData.password) {
          setFormError("Password wajib diisi untuk user baru.");
          setFormSaving(false);
          return;
        }
        await api.post("/admin/users", {
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password,
          role: formData.role,
          kantor_pajak: formData.kantor_pajak || null,
        });
      }
      setDialogOpen(false);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setFormError(axiosErr.response?.data?.detail || "Gagal menyimpan data.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      await fetchData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteTarget(null);
  };

  const handleToggleActive = async (u: UserItem) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active });
      await fetchData();
    } catch (err) {
      console.error("Toggle active failed:", err);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.kantor_pajak || "").toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  if (!isAdmin) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6 h-14">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">Kelola User</h2>
          <p className="text-xs text-muted-foreground truncate">Manajemen pengguna dan statistik</p>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0 ml-2">
          <UserPlus className="h-3.5 w-3.5 sm:mr-2" />
          <span className="hidden sm:inline">Tambah User</span>
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4 sm:space-y-6">

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total User", value: stats.total_users, icon: Users, color: "text-blue-600 bg-blue-50" },
                { label: "User Aktif", value: stats.active_users, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
                { label: "Percakapan", value: stats.total_conversations, icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
                { label: "Total Scan", value: stats.total_scans, icon: ScanLine, color: "text-orange-600 bg-orange-50" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Users Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b">
              <h3 className="text-sm font-semibold">Daftar User ({filteredUsers.length})</h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, email..."
                  className="pl-9 h-8 text-xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="px-6 py-3 text-left font-medium">User</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Kantor Pajak</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Bergabung</th>
                      <th className="px-4 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const roleConfig = ROLE_LABELS[u.role] || ROLE_LABELS.staff;
                      const RoleIcon = roleConfig.icon;
                      return (
                        <tr key={u.id} className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {u.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{u.full_name}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${roleConfig.color}`}>
                              <RoleIcon className="h-3 w-3" />
                              {roleConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {u.kantor_pajak || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={u.id === user?.id}
                              className="inline-flex items-center gap-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {u.is_active ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-500">
                                  <XCircle className="h-3.5 w-3.5" /> Nonaktif
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(u)}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {u.id !== user?.id && (
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                          {search ? "Tidak ada user yang cocok." : "Belum ada user."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Perbarui informasi user. Kosongkan password jika tidak ingin mengubah."
                : "Isi data untuk membuat user baru."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nama Lengkap</label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Nama lengkap"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Password {editingUser && "(kosongkan jika tidak diubah)"}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  placeholder={editingUser ? "••••••" : "Minimal 6 karakter"}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <Select value={formData.role} onValueChange={(v) => v && setFormData((p) => ({ ...p, role: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Kantor Pajak</label>
              <Input
                value={formData.kantor_pajak}
                onChange={(e) => setFormData((p) => ({ ...p, kantor_pajak: e.target.value }))}
                placeholder="Contoh: KPP Pratama Jakarta Selatan"
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Batal
            </DialogClose>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={formSaving || !formData.email || !formData.full_name}
            >
              {formSaving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              {editingUser ? "Simpan" : "Buat User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus User</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email})?
              Semua data percakapan dan scan milik user ini juga akan dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Batal
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Hapus User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
