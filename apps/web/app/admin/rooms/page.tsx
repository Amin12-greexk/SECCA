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
  getProductionRooms,
  createProductionRoom,
  updateProductionRoom,
  deleteProductionRoom,
  type ProductionRoom,
} from '@/lib/api';
import { Edit, Plus, Trash2 } from 'lucide-react';

function RoomsContent() {
  const toast = useToast();
  const [rooms, setRooms] = useState<ProductionRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    name: string;
    type: 'FACTORY' | 'MINIPLANT';
  }>({
    code: '',
    name: '',
    type: 'FACTORY',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionRoom | null>(null);
  const [editForm, setEditForm] = useState<{
    code: string;
    name: string;
    type: 'FACTORY' | 'MINIPLANT';
  }>({
    code: '',
    name: '',
    type: 'FACTORY',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getProductionRooms();
      setRooms(data);
    } catch (error) {
      toast.error('Gagal memuat daftar ruang produksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.type) {
      toast.error('Lengkapi kode, nama, dan tipe ruang.');
      return;
    }
    setAdding(true);
    try {
      await createProductionRoom({
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
      });
      toast.success('Ruang produksi berhasil dibuat.');
      setAddOpen(false);
      setForm({ code: '', name: '', type: 'FACTORY' });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat ruang produksi.');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (room: ProductionRoom) => {
    setEditTarget(room);
    setEditForm({
      code: room.code,
      name: room.name,
      type: room.type,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.code.trim() || !editForm.name.trim() || !editForm.type) {
      toast.error('Lengkapi kode, nama, dan tipe ruang.');
      return;
    }
    setEditing(true);
    try {
      await updateProductionRoom(editTarget.id, {
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        type: editForm.type,
      });
      toast.success('Ruang produksi berhasil diperbarui.');
      setEditOpen(false);
      setEditTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui ruang produksi.');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (room: ProductionRoom) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ruang produksi ${room.name} (${room.code})?`)) {
      return;
    }
    try {
      await deleteProductionRoom(room.id);
      toast.success('Ruang produksi berhasil dihapus.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus ruang produksi.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Manajemen Ruang Produksi</h1>
            <p className="text-sm text-gray-600">
              Kelola daftar ruang produksi Pabrik atau Miniplant.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Ruang
          </Button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : rooms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Belum ada ruang produksi.
                    </td>
                  </tr>
                ) : (
                  rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-gray-50 text-gray-700 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{room.code}</td>
                      <td className="px-4 py-3">{room.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${room.type === 'FACTORY' ? 'bg-blue-50 text-blue-700 ring-blue-700/10' : 'bg-purple-50 text-purple-700 ring-purple-700/10'}`}>
                          {room.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(room)} className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4 text-gray-500" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(room)} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Ruang Produksi</DialogTitle>
            <DialogDescription>Masukkan detail ruang produksi baru.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
               <Label>Kode Ruang</Label>
               <Input
                 value={form.code}
                 onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                 placeholder="Contoh: RM-01"
               />
            </div>
            <div className="space-y-2">
               <Label>Nama Ruang</Label>
               <Input
                 value={form.name}
                 onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                 placeholder="Contoh: Pabrik Pusat"
               />
            </div>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(value: 'FACTORY' | 'MINIPLANT') => setForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FACTORY">Factory (Pabrik)</SelectItem>
                  <SelectItem value="MINIPLANT">Miniplant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              Batal
            </Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Ruang Produksi</DialogTitle>
            <DialogDescription>Ubah detail ruang produksi {editTarget?.code}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
               <Label>Kode Ruang</Label>
               <Input
                 value={editForm.code}
                 onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
               />
            </div>
            <div className="space-y-2">
               <Label>Nama Ruang</Label>
               <Input
                 value={editForm.name}
                 onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
               />
            </div>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select
                value={editForm.type}
                onValueChange={(value: 'FACTORY' | 'MINIPLANT') => setEditForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FACTORY">Factory (Pabrik)</SelectItem>
                  <SelectItem value="MINIPLANT">Miniplant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>
              Batal
            </Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <ProtectedRoute>
      <RoomsContent />
    </ProtectedRoute>
  );
}
