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
import {
  createUser,
  createWorker,
  getUsers,
  getWorkers,
  updateUser,
  type User,
  type Worker,
} from '@/lib/api';

type RoleOption = 'baku' | 'mitra' | 'koreksi' | 'manager' | 'trainer';

function UsersContent() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
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
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as RoleOption | '',
    workerId: '' as string | '',
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

  useEffect(() => {
    loadUsers();
    loadWorkers();
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
      if (form.role === 'mitra' && !workerId) {
        const worker = await createWorker({ name: form.name.trim() });
        workerId = worker.id;
      }
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        workerId,
      });
      toast.success('Akun berhasil dibuat.');
      setForm({ name: '', email: '', password: '', role: '', workerId: '' });
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat akun.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name ?? '',
      email: user.email ?? '',
      password: '',
      role: (user.role as RoleOption) ?? '',
      workerId: user.workerId ?? '',
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
      if (editForm.role === 'mitra' && !workerId) {
        const worker = await createWorker({ name: editForm.name.trim() });
        workerId = worker.id;
      }
      await updateUser(editUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        password: editForm.password ? editForm.password : undefined,
        workerId,
      });
      toast.success('Akun berhasil diperbarui.');
      setEditOpen(false);
      setEditUser(null);
      await loadUsers();
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
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-500">
                        Memuat data...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-500">
                        Belum ada akun.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="text-gray-700">
                        <td className="py-2 font-medium">{user.name}</td>
                        <td className="py-2">{user.email}</td>
                        <td className="py-2 capitalize">{user.role}</td>
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

