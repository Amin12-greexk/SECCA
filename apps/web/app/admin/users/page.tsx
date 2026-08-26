'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/lib/toast';
import { UI_ACCESS_MODULES } from '@/lib/access-control';
import type { UiAccessModuleKey } from '@/lib/types/auth';
import {
  createUser,
  createWorker,
  getProductionRooms,
  getUsers,
  getWorkers,
  updateWorker,
  updateUser,
  type ProductionRoom,
  type User,
  type Worker,
} from '@/lib/api';

type RoleOption = 'baku' | 'mitra' | 'koreksi' | 'manager' | 'trainer' | 'admin';
type UiAccessDraft = Partial<Record<UiAccessModuleKey, number>>;

function buildUiAccessDraft(
  uiAccesses: Array<{ moduleKey: string; level: number }> | undefined,
): UiAccessDraft {
  return (uiAccesses ?? []).reduce<UiAccessDraft>((acc, item) => {
    acc[item.moduleKey as UiAccessModuleKey] = item.level;
    return acc;
  }, {});
}

function serializeUiAccessDraft(draft: UiAccessDraft) {
  return Object.entries(draft)
    .filter((entry): entry is [UiAccessModuleKey, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([moduleKey, level]) => ({ moduleKey, level }))
    .sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
}

function UsersContent() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [productionRooms, setProductionRooms] = useState<ProductionRoom[]>([]);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [editSaving, setEditSaving] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as RoleOption | '',
    workerId: '' as string | '',
    productionRoomId: '' as string | '',
    pin: '',
    useCustomUiAccess: false,
    uiAccessDraft: {} as UiAccessDraft,
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as RoleOption | '',
    workerId: '' as string | '',
    productionRoomId: '' as string | '',
    pin: '',
    useCustomUiAccess: false,
    uiAccessDraft: {} as UiAccessDraft,
  });

  const USERS_PER_PAGE = 10;
  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.role, user.productionRoom?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [userQuery, users]);
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const visibleUsers = filteredUsers.slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE,
  );

  useEffect(() => {
    setUserPage(1);
  }, [userQuery]);

  useEffect(() => {
    if (userPage > totalUserPages) setUserPage(totalUserPages);
  }, [totalUserPages, userPage]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      toast.error('Gagal memuat daftar akun.');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkers = async () => {
    setWorkersLoading(true);
    try {
      const data = await getWorkers();
      setWorkers(data);
    } catch (error) {
      toast.error('Gagal memuat daftar mitra.');
    } finally {
      setWorkersLoading(false);
    }
  };

  const loadProductionRooms = async () => {
    try {
      const rooms = await getProductionRooms();
      setProductionRooms(rooms);
    } catch (error) {
      console.error('Gagal memuat ruang produksi:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadWorkers();
    loadProductionRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.role) {
      toast.error('Lengkapi semua data akun.');
      return;
    }
    setSaving(true);
    try {
      let workerId = form.workerId || undefined;
      const pin = form.pin.replace(/\D/g, '').slice(0, 6);
      if (form.role === 'mitra' && pin && pin.length < 3) {
        toast.error('PIN mitra minimal 3 digit.');
        return;
      }
      if (form.role === 'mitra' && !workerId) {
        const worker = await createWorker({
          name: form.name.trim(),
          pin: pin || undefined,
        });
        workerId = worker.id;
      } else if (form.role === 'mitra' && workerId && pin) {
        await updateWorker(workerId, { pin });
      }
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        workerId,
        productionRoomId: form.productionRoomId || undefined,
        useCustomUiAccess: form.useCustomUiAccess,
        uiAccesses: serializeUiAccessDraft(form.uiAccessDraft),
      });
      toast.success('Akun berhasil dibuat.');
      setForm({
        name: '',
        email: '',
        password: '',
        role: '',
        workerId: '',
        productionRoomId: '',
        pin: '',
        useCustomUiAccess: false,
        uiAccessDraft: {},
      });
      setCreateOpen(false);
      await loadUsers();
      await loadWorkers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat akun.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: User) => {
    const worker = workers.find((item) => item.id === user.workerId);
    setEditUser(user);
    setEditForm({
      name: user.name ?? '',
      email: user.email ?? '',
      password: '',
      role: (user.role as RoleOption) ?? '',
      workerId: user.workerId ?? '',
      productionRoomId: user.productionRoomId ?? '',
      pin: worker?.pin ?? '',
      useCustomUiAccess: user.useCustomUiAccess ?? false,
      uiAccessDraft: buildUiAccessDraft(user.uiAccesses),
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editUser) return;

    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.role) {
      toast.error('Lengkapi nama, email, dan role.');
      return;
    }
    setEditSaving(true);
    try {
      let workerId = editForm.workerId || null;
      const pin = editForm.pin.replace(/\D/g, '').slice(0, 6);
      if (editForm.role === 'mitra' && pin && pin.length < 3) {
        toast.error('PIN mitra minimal 3 digit.');
        return;
      }
      if (editForm.role === 'mitra' && !workerId) {
        const worker = await createWorker({
          name: editForm.name.trim(),
          pin: pin || undefined,
        });
        workerId = worker.id;
      } else if (editForm.role === 'mitra' && workerId) {
        await updateWorker(workerId, { pin: pin || null });
      }
      await updateUser(editUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        password: editForm.password ? editForm.password : undefined,
        workerId,
        productionRoomId: editForm.productionRoomId || null,
        useCustomUiAccess: editForm.useCustomUiAccess,
        uiAccesses: serializeUiAccessDraft(editForm.uiAccessDraft),
      });
      toast.success('Akun berhasil diperbarui.');
      setEditOpen(false);
      setEditUser(null);
      await loadUsers();
      await loadWorkers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui akun.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-emerald-50/50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Page Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Manajemen Akun</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manager dapat membuat akun baru dan menentukan rolenya.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button
              onClick={() => setCreateOpen(true)}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 4v16m8-8H4" />
              </svg>
              Tambah Akun
            </Button>
            <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register Akun Baru</DialogTitle>
                <DialogDescription>
                  Isi data akun, role, dan relasi mitra bila diperlukan.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as RoleOption }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baku">Baku</SelectItem>
                    <SelectItem value="mitra">Mitra</SelectItem>
                    <SelectItem value="koreksi">Koreksi</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ruang Produksi (opsional)</Label>
                <Select
                  value={form.productionRoomId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, productionRoomId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Ruang Produksi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tanpa Ruang Produksi --</SelectItem>
                    {productionRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} ({room.code}) - {room.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.role === 'mitra' && (
                <div className="space-y-2">
                  <Label>Pilih Mitra (opsional)</Label>
                  <Select
                    value={form.workerId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, workerId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-buat mitra dari nama akun" />
                    </SelectTrigger>
                    <SelectContent>
                      {workersLoading ? (
                        <SelectItem value="loading" disabled>
                          Memuat mitra...
                        </SelectItem>
                      ) : workers.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          Belum ada mitra
                        </SelectItem>
                      ) : (
                        workers.map((worker) => (
                          <SelectItem key={worker.id} value={worker.id}>
                            {worker.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.role === 'mitra' && (
                <div className="space-y-2">
                  <Label>PIN Mitra (opsional)</Label>
                  <Input
                    value={form.pin}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        pin: event.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
              )}
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-sm font-semibold text-gray-900">Akses UI per User</Label>
                    <p className="mt-1 text-xs text-gray-500">
                      Aktifkan jika menu user ini ingin diatur khusus dan tidak mengikuti default role.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.useCustomUiAccess}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          useCustomUiAccess: event.target.checked,
                        }))
                      }
                    />
                    Aktif
                  </label>
                </div>

                {form.useCustomUiAccess ? (
                  <div className="space-y-3">
                    {UI_ACCESS_MODULES.map((module) => (
                      <div
                        key={module.key}
                        className="rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-900">{module.label}</p>
                          <p className="text-xs text-gray-500">{module.description}</p>
                        </div>
                        <select
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          value={String(form.uiAccessDraft[module.key] ?? 0)}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              uiAccessDraft: {
                                ...prev.uiAccessDraft,
                                [module.key]: Number(event.target.value),
                              },
                            }))
                          }
                        >
                          <option value="0">Tidak ditampilkan</option>
                          {module.levels.map((level) => (
                            <option key={level.level} value={String(level.level)}>
                              Level {level.level} - {level.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-500">
                          {module.levels.find((level) => level.level === (form.uiAccessDraft[module.key] ?? 0))
                            ?.description ?? 'Menu ini disembunyikan.'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
                <Button className="w-full" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Akun'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Full-width Table Card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Table Header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Daftar Akun</h2>
              <p className="text-xs text-gray-400 mt-0.5">{filteredUsers.length} akun terdaftar</p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                className="w-64"
                placeholder="Cari nama, email, role..."
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
              />
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3 font-semibold">Nama</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Ruang Produksi</th>
                  <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <svg className="w-8 h-8 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
                          </svg>
                          <span className="text-sm">Memuat data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <svg className="w-10 h-10" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm">{userQuery ? 'Tidak ada akun yang cocok.' : 'Belum ada akun.'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleUsers.map((user) => {
                      const roleColors: Record<string, string> = {
                        manager: 'bg-purple-50 text-purple-700 border-purple-200',
                        baku: 'bg-amber-50 text-amber-700 border-amber-200',
                        mitra: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                        koreksi: 'bg-teal-50 text-teal-700 border-teal-200',
                        trainer: 'bg-blue-50 text-blue-700 border-blue-200',
                      };
                      const roleColor = roleColors[user.role] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                      return (
                        <tr key={user.id} className="hover:bg-emerald-50/40 transition-colors duration-150">
                          <td className="px-6 py-3.5 font-medium text-gray-900">{user.name}</td>
                          <td className="px-6 py-3.5 text-gray-500">{user.email}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${roleColor} w-fit capitalize`}>
                                {user.role}
                              </span>
                              {user.useCustomUiAccess ? (
                                <span className="text-xs text-emerald-600 font-medium">Akses UI khusus</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-xs">
                            {user.productionRoom ? (
                              <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 font-medium text-rose-700">
                                {user.productionRoom.name}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <Button variant="outline" size="sm" onClick={() => openEdit(user)} className="text-xs">
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-500">
              Menampilkan {filteredUsers.length === 0 ? 0 : (userPage - 1) * USERS_PER_PAGE + 1}–{Math.min(userPage * USERS_PER_PAGE, filteredUsers.length)} dari {filteredUsers.length} akun
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                disabled={userPage <= 1}
              >
                ← Sebelumnya
              </Button>
              <span className="text-xs text-gray-500 px-1">Hal {userPage} / {totalUserPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                disabled={userPage >= totalUserPages}
              >
                Berikutnya →
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Akun</DialogTitle>
            <DialogDescription>Perbarui data akun dan role pengguna.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Password (opsional)</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value as RoleOption }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baku">Baku</SelectItem>
                  <SelectItem value="mitra">Mitra</SelectItem>
                  <SelectItem value="koreksi">Koreksi</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ruang Produksi (opsional)</Label>
              <Select
                value={editForm.productionRoomId}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, productionRoomId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Ruang Produksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tanpa Ruang Produksi --</SelectItem>
                  {productionRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} ({room.code}) - {room.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editForm.role === 'mitra' && (
              <div className="space-y-2">
                <Label>Pilih Mitra (opsional)</Label>
                <Select
                  value={editForm.workerId}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, workerId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-buat mitra dari nama akun" />
                  </SelectTrigger>
                  <SelectContent>
                    {workersLoading ? (
                      <SelectItem value="loading" disabled>
                        Memuat mitra...
                      </SelectItem>
                    ) : workers.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Belum ada mitra
                      </SelectItem>
                    ) : (
                      workers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editForm.role === 'mitra' && (
              <div className="space-y-2">
                <Label>PIN Mitra</Label>
                <Input
                  value={editForm.pin}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      pin: event.target.value.replace(/\D/g, '').slice(0, 6),
                    }))
                  }
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
            )}
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-sm font-semibold text-gray-900">Akses UI per User</Label>
                  <p className="mt-1 text-xs text-gray-500">
                    Jika aktif, menu dan halaman user ini memakai akses khusus dan tidak lagi mengikuti default role.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.useCustomUiAccess}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        useCustomUiAccess: event.target.checked,
                      }))
                    }
                  />
                  Aktif
                </label>
              </div>

              {editForm.useCustomUiAccess ? (
                <div className="space-y-3">
                  {UI_ACCESS_MODULES.map((module) => (
                    <div
                      key={module.key}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-900">{module.label}</p>
                        <p className="text-xs text-gray-500">{module.description}</p>
                      </div>
                      <select
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        value={String(editForm.uiAccessDraft[module.key] ?? 0)}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            uiAccessDraft: {
                              ...prev.uiAccessDraft,
                              [module.key]: Number(event.target.value),
                            },
                          }))
                        }
                      >
                        <option value="0">Tidak ditampilkan</option>
                        {module.levels.map((level) => (
                          <option key={level.level} value={String(level.level)}>
                            Level {level.level} - {level.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-gray-500">
                        {module.levels.find((level) => level.level === (editForm.uiAccessDraft[module.key] ?? 0))
                          ?.description ?? 'Menu ini disembunyikan.'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <UsersContent />
    </ProtectedRoute>
  );
}

