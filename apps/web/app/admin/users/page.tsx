'use client';

import { useEffect, useState } from 'react';
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

type RoleOption = 'baku' | 'mitra' | 'koreksi' | 'manager' | 'trainer';
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
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manajemen Akun</h1>
          <p className="text-sm text-gray-600">
            Manager dapat membuat akun baru dan menentukan rolenya.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Buat Akun</h2>
            <div className="mt-4 space-y-4">
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
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#059833]"
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
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Daftar Akun</h2>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                Refresh
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2">Nama</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Ruang Produksi</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        Memuat data...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        Belum ada akun.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="text-gray-700">
                        <td className="py-2 font-medium">{user.name}</td>
                        <td className="py-2">{user.email}</td>
                        <td className="py-2">
                          <div className="flex flex-col">
                            <span className="capitalize">{user.role}</span>
                            {user.useCustomUiAccess ? (
                              <span className="text-xs text-[#059833]">Akses UI khusus</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 text-xs">
                          {user.productionRoom ? (
                            <span className="rounded bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                              {user.productionRoom.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#059833]"
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
    <ProtectedRoute allowedRoles={['manager']}>
      <UsersContent />
    </ProtectedRoute>
  );
}

