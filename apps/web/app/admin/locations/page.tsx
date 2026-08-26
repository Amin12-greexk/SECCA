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
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  type RackLocation,
} from '@/lib/api';
import { Edit, Trash2 } from 'lucide-react';

interface ExtendedLocation extends RackLocation {
  _count?: { lots: number };
}

function LocationsContent() {
  const toast = useToast();
  const [locations, setLocations] = useState<ExtendedLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'RACK',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<ExtendedLocation | null>(null);
  const [editForm, setEditForm] = useState({
    code: '',
    name: '',
    type: 'RACK',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (error) {
      toast.error('Gagal memuat daftar lokasi.');
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
      toast.error('Lengkapi kode, nama, dan tipe lokasi.');
      return;
    }
    setAdding(true);
    try {
      await createLocation({
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
      });
      toast.success('Lokasi berhasil dibuat.');
      setAddOpen(false);
      setForm({ code: '', name: '', type: 'RACK' });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat lokasi.');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (loc: ExtendedLocation) => {
    setEditTarget(loc);
    setEditForm({
      code: loc.code,
      name: loc.name,
      type: loc.type,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.code.trim() || !editForm.name.trim() || !editForm.type) {
      toast.error('Lengkapi kode, nama, dan tipe lokasi.');
      return;
    }
    setEditing(true);
    try {
      await updateLocation(editTarget.id, {
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        type: editForm.type,
      });
      toast.success('Lokasi berhasil diperbarui.');
      setEditOpen(false);
      setEditTarget(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui lokasi.');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (loc: ExtendedLocation) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus lokasi ${loc.name} (${loc.code})?`)) {
      return;
    }
    try {
      await deleteLocation(loc.id);
      toast.success('Lokasi berhasil dihapus.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus lokasi.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Manajemen Lokasi & Rak</h1>
            <p className="text-sm text-gray-600">
              Kelola daftar lokasi penyimpanan atau rak kerja.
            </p>
          </div>
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Rak Order dan Rak Finished dibuat otomatis untuk setiap ruang produksi.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Ruang Produksi</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Pekerja</th>
                  <th className="px-4 py-3 text-right">Lot Terkait</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Belum ada lokasi.
                    </td>
                  </tr>
                ) : (
                  locations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-gray-50 text-gray-700 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{loc.code}</td>
                      <td className="px-4 py-3">{loc.name}</td>
                      <td className="px-4 py-3">
                        {loc.productionRoom?.name ?? 'Global / Umum'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {loc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {loc.worker?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {loc._count?.lots ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {loc.productionRoomId &&
                        (loc.type === 'MITRA_ORDER' || loc.type === 'FINISHED') ? (
                          <span className="text-xs font-medium text-emerald-700">
                            Otomatis
                          </span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(loc)} className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4 text-gray-500" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(loc)} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
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
            <DialogTitle>Tambah Lokasi Baru</DialogTitle>
            <DialogDescription>Masukkan detail lokasi penyimpanan atau rak kerja baru.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kode Lokasi</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="Contoh: RAK-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Lokasi</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Rak Kering 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RACK">Rack (Penyimpanan)</SelectItem>
                  <SelectItem value="WORKSTATION">Workstation (Meja Kerja)</SelectItem>
                  <SelectItem value="DRYING">Drying (Ruang Jemur)</SelectItem>
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
            <DialogTitle>Edit Lokasi</DialogTitle>
            <DialogDescription>Ubah detail lokasi {editTarget?.code}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kode Lokasi</Label>
              <Input
                value={editForm.code}
                onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nama Lokasi</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select
                value={editForm.type}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RACK">Rack (Penyimpanan)</SelectItem>
                  <SelectItem value="WORKSTATION">Workstation (Meja Kerja)</SelectItem>
                  <SelectItem value="DRYING">Drying (Ruang Jemur)</SelectItem>
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

export default function LocationsPage() {
  return (
    <ProtectedRoute>
      <LocationsContent />
    </ProtectedRoute>
  );
}
