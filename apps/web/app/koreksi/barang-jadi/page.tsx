'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createBarangJadi,
  createByProductType,
  createResultGradeType,
  deleteBarangJadi,
  deleteByProductType,
  deleteResultGradeType,
  getBarangJadiList,
  getByProductTypes,
  getResultGradeTypes,
  type BarangJadi,
  type ByProductType,
  type ResultGradeType,
  updateBarangJadi,
  updateByProductType,
  updateResultGradeType,
} from '@/lib/api';
import { BARANG_JADI_UPDATED_EVENT } from '@/lib/barang-jadi';
import { useToast } from '@/lib/toast';

const FIELD_CLASSNAME = 'shadow-none';

function BarangJadiContent() {
  const toast = useToast();
  const toastRef = useRef(toast);

  const [barangJadiItems, setBarangJadiItems] = useState<BarangJadi[]>([]);
  const [byProductTypes, setByProductTypes] = useState<ByProductType[]>([]);
  const [resultGradeTypes, setResultGradeTypes] = useState<ResultGradeType[]>([]);
  const [selectedBarangJadiId, setSelectedBarangJadiId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draftBarangJadiName, setDraftBarangJadiName] = useState('');
  const [editingBarangJadiId, setEditingBarangJadiId] = useState<string | null>(null);
  const [editingBarangJadiName, setEditingBarangJadiName] = useState('');

  const [draftByProductName, setDraftByProductName] = useState('');
  const [editingByProductId, setEditingByProductId] = useState<string | null>(null);
  const [editingByProductName, setEditingByProductName] = useState('');
  const [draftResultGradeName, setDraftResultGradeName] = useState('');
  const [editingResultGradeId, setEditingResultGradeId] = useState<string | null>(null);
  const [editingResultGradeName, setEditingResultGradeName] = useState('');

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const notifyUpdated = useCallback(() => {
    window.dispatchEvent(new Event(BARANG_JADI_UPDATED_EVENT));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [barangJadiRows, byProductRows, resultGradeRows] = await Promise.all([
        getBarangJadiList(),
        getByProductTypes(),
        getResultGradeTypes(),
      ]);
      setBarangJadiItems(barangJadiRows);
      setByProductTypes(byProductRows);
      setResultGradeTypes(resultGradeRows);
    } catch (error) {
      toastRef.current.error(error instanceof Error ? error.message : 'Gagal memuat master data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const sortedBarangJadi = useMemo(
    () => [...barangJadiItems].sort((a, b) => a.name.localeCompare(b.name, 'id-ID')),
    [barangJadiItems],
  );
  const sortedByProducts = useMemo(
    () => [...byProductTypes].sort((a, b) => a.name.localeCompare(b.name, 'id-ID')),
    [byProductTypes],
  );
  const sortedResultGrades = useMemo(
    () => [...resultGradeTypes].sort((a, b) => a.name.localeCompare(b.name, 'id-ID')),
    [resultGradeTypes],
  );

  useEffect(() => {
    if (sortedBarangJadi.length === 0) {
      if (selectedBarangJadiId !== null) {
        setSelectedBarangJadiId(null);
      }
      return;
    }

    if (!selectedBarangJadiId || !sortedBarangJadi.some((item) => item.id === selectedBarangJadiId)) {
      setSelectedBarangJadiId(sortedBarangJadi[0].id);
    }
  }, [selectedBarangJadiId, sortedBarangJadi]);

  const selectedBarangJadi = useMemo(
    () => sortedBarangJadi.find((item) => item.id === selectedBarangJadiId) ?? null,
    [selectedBarangJadiId, sortedBarangJadi],
  );

  const selectedByProductIds = useMemo(
    () => selectedBarangJadi?.byProducts.map((item) => item.id) ?? [],
    [selectedBarangJadi],
  );

  const attachedByProducts = useMemo(
    () => sortedByProducts.filter((item) => selectedByProductIds.includes(item.id)),
    [selectedByProductIds, sortedByProducts],
  );
  const selectedResultGradeIds = useMemo(
    () => selectedBarangJadi?.resultGrades.map((item) => item.id) ?? [],
    [selectedBarangJadi],
  );
  const attachedResultGrades = useMemo(
    () => sortedResultGrades.filter((item) => selectedResultGradeIds.includes(item.id)),
    [selectedResultGradeIds, sortedResultGrades],
  );

  const replaceBarangJadi = useCallback((updated: BarangJadi) => {
    setBarangJadiItems((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }, []);

  const resetBarangJadiForm = () => {
    setDraftBarangJadiName('');
  };

  const handleCreateBarangJadi = async () => {
    const name = draftBarangJadiName.trim().toUpperCase();
    if (!name) {
      toast.error('Nama barang jadi wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const created = await createBarangJadi({
        name,
        byProductTypeIds: [],
        resultGradeTypeIds: [],
      });
      resetBarangJadiForm();
      await loadAll();
      setSelectedBarangJadiId(created.id);
      notifyUpdated();
      toast.success('Barang jadi ditambahkan.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menambah barang jadi.');
    } finally {
      setSaving(false);
    }
  };

  const startEditBarangJadi = (item: BarangJadi) => {
    setEditingBarangJadiId(item.id);
    setEditingBarangJadiName(item.name);
  };

  const cancelEditBarangJadi = () => {
    setEditingBarangJadiId(null);
    setEditingBarangJadiName('');
  };

  const handleSaveBarangJadi = async () => {
    if (!editingBarangJadiId) return;

    const name = editingBarangJadiName.trim().toUpperCase();
    if (!name) {
      toast.error('Nama barang jadi wajib diisi.');
      return;
    }

    const current = sortedBarangJadi.find((item) => item.id === editingBarangJadiId);
    if (!current) {
      toast.error('Barang jadi tidak ditemukan.');
      return;
    }

    setSaving(true);
    try {
      await updateBarangJadi(editingBarangJadiId, {
        name,
        byProductTypeIds: current.byProducts.map((item) => item.id),
        resultGradeTypeIds: current.resultGrades.map((item) => item.id),
      });
      cancelEditBarangJadi();
      await loadAll();
      notifyUpdated();
      toast.success('Barang jadi diperbarui.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui barang jadi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBarangJadi = async (item: BarangJadi) => {
    const confirmed = window.confirm(`Hapus barang jadi ${item.name}?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteBarangJadi(item.id);
      if (editingBarangJadiId === item.id) {
        cancelEditBarangJadi();
      }
      await loadAll();
      notifyUpdated();
      toast.success('Barang jadi dihapus.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus barang jadi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDetachByProduct = async (byProductTypeId: string) => {
    if (!selectedBarangJadi) {
      toast.error('Pilih barang jadi terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      await updateBarangJadi(selectedBarangJadi.id, {
        name: selectedBarangJadi.name,
        byProductTypeIds: selectedByProductIds.filter((item) => item !== byProductTypeId),
        resultGradeTypeIds: selectedResultGradeIds,
      });
      await loadAll();
      setSelectedBarangJadiId(selectedBarangJadi.id);
      notifyUpdated();
      toast.success('By product dilepas dari barang jadi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal melepas by product.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndAttachByProduct = async () => {
    if (!selectedBarangJadi) {
      toast.error('Pilih barang jadi terlebih dahulu.');
      return;
    }

    const name = draftByProductName.trim().toUpperCase();
    if (!name) {
      toast.error('Nama by product wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      let knownByProducts = byProductTypes;
      let existing = knownByProducts.find((item) => item.name.trim().toUpperCase() === name);

      if (!existing) {
        try {
          const created = await createByProductType({ name });
          knownByProducts = [...knownByProducts, created];
          setByProductTypes(knownByProducts);
          existing = created;
        } catch (error) {
          if (!(error instanceof Error) || !error.message.toLowerCase().includes('sudah ada')) {
            throw error;
          }

          knownByProducts = await getByProductTypes();
          setByProductTypes(knownByProducts);
          existing = knownByProducts.find((item) => item.name.trim().toUpperCase() === name);

          if (!existing) {
            throw error;
          }
        }
      }

      const byProductTypeId = existing.id;

      if (selectedByProductIds.includes(byProductTypeId)) {
        toast.error('By product ini sudah terpasang.');
        return;
      }

      const updated = await updateBarangJadi(selectedBarangJadi.id, {
        name: selectedBarangJadi.name,
        byProductTypeIds: [...selectedByProductIds, byProductTypeId],
        resultGradeTypeIds: selectedResultGradeIds,
      });
      replaceBarangJadi(updated);
      setDraftByProductName('');
      setSelectedBarangJadiId(selectedBarangJadi.id);
      notifyUpdated();
      toast.success('By product dipasang ke barang jadi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menambah by product.');
    } finally {
      setSaving(false);
    }
  };

  const startEditByProduct = (item: ByProductType) => {
    setEditingByProductId(item.id);
    setEditingByProductName(item.name);
  };

  const cancelEditByProduct = () => {
    setEditingByProductId(null);
    setEditingByProductName('');
  };

  const handleSaveByProduct = async () => {
    if (!editingByProductId) return;

    const name = editingByProductName.trim().toUpperCase();
    if (!name) {
      toast.error('Nama by product wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await updateByProductType(editingByProductId, { name });
      cancelEditByProduct();
      await loadAll();
      notifyUpdated();
      toast.success('Nama by product diperbarui.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui by product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteByProduct = async (item: ByProductType) => {
    const confirmed = window.confirm(`Hapus by product ${item.name}?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      if (selectedBarangJadi && selectedByProductIds.includes(item.id)) {
        await updateBarangJadi(selectedBarangJadi.id, {
          name: selectedBarangJadi.name,
          byProductTypeIds: selectedByProductIds.filter((currentId) => currentId !== item.id),
          resultGradeTypeIds: selectedResultGradeIds,
        });
      }
      await deleteByProductType(item.id);
      if (editingByProductId === item.id) {
        cancelEditByProduct();
      }
      await loadAll();
      notifyUpdated();
      toast.success('By product dihapus.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus by product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDetachResultGrade = async (resultGradeTypeId: string) => {
    if (!selectedBarangJadi) {
      toast.error('Pilih barang jadi terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      await updateBarangJadi(selectedBarangJadi.id, {
        name: selectedBarangJadi.name,
        byProductTypeIds: selectedByProductIds,
        resultGradeTypeIds: selectedResultGradeIds.filter((item) => item !== resultGradeTypeId),
      });
      await loadAll();
      setSelectedBarangJadiId(selectedBarangJadi.id);
      notifyUpdated();
      toast.success('Grade hasil dilepas dari barang jadi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal melepas grade hasil.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndAttachResultGrade = async () => {
    if (!selectedBarangJadi) {
      toast.error('Pilih barang jadi terlebih dahulu.');
      return;
    }

    const name = draftResultGradeName.trim().toUpperCase();
    if (!name) {
      toast.error('Nama grade hasil wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      let knownResultGrades = resultGradeTypes;
      let existing = knownResultGrades.find((item) => item.name.trim().toUpperCase() === name);

      if (!existing) {
        try {
          const created = await createResultGradeType({ name });
          knownResultGrades = [...knownResultGrades, created];
          setResultGradeTypes(knownResultGrades);
          existing = created;
        } catch (error) {
          if (!(error instanceof Error) || !error.message.toLowerCase().includes('sudah ada')) {
            throw error;
          }

          knownResultGrades = await getResultGradeTypes();
          setResultGradeTypes(knownResultGrades);
          existing = knownResultGrades.find((item) => item.name.trim().toUpperCase() === name);

          if (!existing) {
            throw error;
          }
        }
      }

      const resultGradeTypeId = existing.id;

      if (selectedResultGradeIds.includes(resultGradeTypeId)) {
        toast.error('Grade hasil ini sudah terpasang.');
        return;
      }

      const updated = await updateBarangJadi(selectedBarangJadi.id, {
        name: selectedBarangJadi.name,
        byProductTypeIds: selectedByProductIds,
        resultGradeTypeIds: [...selectedResultGradeIds, resultGradeTypeId],
      });
      replaceBarangJadi(updated);
      setDraftResultGradeName('');
      setSelectedBarangJadiId(selectedBarangJadi.id);
      notifyUpdated();
      toast.success('Grade hasil dipasang ke barang jadi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menambah grade hasil.');
    } finally {
      setSaving(false);
    }
  };

  const startEditResultGrade = (item: ResultGradeType) => {
    setEditingResultGradeId(item.id);
    setEditingResultGradeName(item.name);
  };

  const cancelEditResultGrade = () => {
    setEditingResultGradeId(null);
    setEditingResultGradeName('');
  };

  const handleSaveResultGrade = async () => {
    if (!editingResultGradeId) return;

    const name = editingResultGradeName.trim().toUpperCase();
    if (!name) {
      toast.error('Nama grade hasil wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await updateResultGradeType(editingResultGradeId, { name });
      cancelEditResultGrade();
      await loadAll();
      notifyUpdated();
      toast.success('Nama grade hasil diperbarui.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui grade hasil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResultGrade = async (item: ResultGradeType) => {
    const confirmed = window.confirm(`Hapus grade hasil ${item.name}?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      if (selectedBarangJadi && selectedResultGradeIds.includes(item.id)) {
        await updateBarangJadi(selectedBarangJadi.id, {
          name: selectedBarangJadi.name,
          byProductTypeIds: selectedByProductIds,
          resultGradeTypeIds: selectedResultGradeIds.filter((currentId) => currentId !== item.id),
        });
      }
      await deleteResultGradeType(item.id);
      if (editingResultGradeId === item.id) {
        cancelEditResultGrade();
      }
      await loadAll();
      notifyUpdated();
      toast.success('Grade hasil dihapus.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus grade hasil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Master Barang Jadi</h1>
            <p className="text-sm text-gray-600">
              Kelola daftar Barang Jadi, By Product, dan Grade Hasil yang menyertainya.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading || saving}>
            Refresh Data
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Kolom Kiri: Master List Barang Jadi */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">1. Tambah Barang Jadi Utama</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="barang-jadi-name" className="sr-only">Nama Barang Jadi</Label>
                  <Input
                    id="barang-jadi-name"
                    className={FIELD_CLASSNAME}
                    value={draftBarangJadiName}
                    onChange={(event) => setDraftBarangJadiName(event.target.value)}
                    placeholder="Contoh: STANDAR, INDOMIE..."
                    disabled={saving}
                  />
                </div>
                <Button onClick={() => void handleCreateBarangJadi()} disabled={saving} className="shrink-0 bg-[#059833] hover:bg-[#047a29]">
                  {saving ? 'Menyimpan...' : 'Tambah'}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Daftar Barang Jadi</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {sortedBarangJadi.length}
                </span>
              </div>

              {loading ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  Memuat data...
                </div>
              ) : sortedBarangJadi.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  Belum ada master Barang Jadi.
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {sortedBarangJadi.map((item) => {
                    const isSelected = item.id === selectedBarangJadiId;
                    const isEditing = item.id === editingBarangJadiId;

                    return (
                      <div
                        key={item.id}
                        className={`group relative overflow-hidden rounded-lg border transition-all ${
                          isSelected
                            ? 'border-[#059833] bg-[#059833]/[0.02] shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute inset-y-0 left-0 w-1 bg-[#059833]" />
                        )}
                        <div className="p-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                id={`edit-barang-jadi-${item.id}`}
                                className="h-8 text-sm shadow-none"
                                value={editingBarangJadiName}
                                onChange={(event) => setEditingBarangJadiName(event.target.value)}
                                disabled={saving}
                                autoFocus
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => void handleSaveBarangJadi()} disabled={saving} className="h-7 text-xs bg-[#059833] hover:bg-[#047a29]">
                                  Simpan
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEditBarangJadi} disabled={saving} className="h-7 text-xs text-gray-500 hover:text-gray-900">
                                  Batal
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div
                                role="button"
                                tabIndex={0}
                                className="min-w-0 flex-1 cursor-pointer outline-none"
                                onClick={() => setSelectedBarangJadiId(item.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedBarangJadiId(item.id);
                                  }
                                }}
                              >
                                <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[#059833]' : 'text-gray-900'}`}>
                                  {item.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500 truncate">
                                  {item.byProducts.length} By Product • {item.resultGrades.length} Grade hasil
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" onClick={() => startEditBarangJadi(item)} disabled={saving} className="h-7 w-7 p-0 text-gray-500 hover:text-gray-900">
                                  <span className="text-xs">Edit</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void handleDeleteBarangJadi(item)}
                                  disabled={saving}
                                  className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                >
                                  <span className="text-xs">Del</span>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan: Detail Komponen */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">2. Kelola Komponen</h2>
            <p className="mb-4 text-xs text-gray-500">
              Pilih Barang Jadi di sebelah kiri untuk mengatur By Product dan Grade Hasil-nya.
            </p>

            {!selectedBarangJadi ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 text-center text-sm text-gray-500">
                Pilih Barang Jadi terlebih dahulu.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border border-[#059833]/20 bg-[#059833]/5 p-3">
                  <p className="text-xs font-medium text-gray-600">Barang Jadi aktif:</p>
                  <p className="text-sm font-bold text-[#059833]">{selectedBarangJadi.name}</p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Komponen Aktif</h3>
                  {attachedByProducts.length === 0 ? (
                     <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
                       Belum ada By Product. Silakan tambahkan di bawah.
                     </div>
                  ) : (
                    <div className="space-y-2">
                       {attachedByProducts.map((item) => (
                         <div key={item.id} className="group flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5 transition-colors hover:border-gray-200 hover:bg-white">
                           {editingByProductId === item.id ? (
                             <div className="flex w-full items-center gap-2">
                               <Input
                                 className="h-7 text-xs shadow-none flex-1"
                                 value={editingByProductName}
                                 onChange={(e) => setEditingByProductName(e.target.value)}
                                 autoFocus
                               />
                               <Button size="sm" onClick={() => void handleSaveByProduct()} className="h-7 px-2 text-[10px] bg-[#059833]">Simpan</Button>
                               <Button size="sm" variant="ghost" onClick={cancelEditByProduct} className="h-7 px-2 text-[10px] text-gray-500">Batal</Button>
                             </div>
                           ) : (
                             <>
                               <span className="text-sm font-medium text-gray-800">{item.name}</span>
                               <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                 <Button size="sm" variant="ghost" onClick={() => startEditByProduct(item)} className="h-6 w-auto px-2 text-[10px] text-gray-500 hover:text-gray-900">
                                   Edit
                                 </Button>
                                 <Button size="sm" variant="outline" onClick={() => void handleDetachByProduct(item.id)} className="h-6 w-auto px-2 text-[10px] text-amber-600 hover:bg-amber-50 hover:text-amber-700 border-amber-200">
                                   Lepas
                                 </Button>
                                 <Button size="sm" variant="ghost" onClick={() => void handleDeleteByProduct(item)} className="h-6 w-auto px-2 text-[10px] text-red-500 hover:bg-red-50 hover:text-red-700">
                                   Hapus Global
                                 </Button>
                               </div>
                             </>
                           )}
                         </div>
                       ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <Label htmlFor="by-product-name" className="text-xs font-semibold text-gray-900">Tambah ke {selectedBarangJadi.name}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="by-product-name"
                      className={`${FIELD_CLASSNAME} h-9`}
                      value={draftByProductName}
                      onChange={(event) => setDraftByProductName(event.target.value)}
                      placeholder="Ketik By Product baru/lama..."
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleCreateAndAttachByProduct();
                        }
                      }}
                    />
                    <Button onClick={() => void handleCreateAndAttachByProduct()} disabled={saving} className="h-9 shrink-0 bg-[#059833] hover:bg-[#047a29]">
                      {saving ? 'Otw...' : 'Pasang'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Grade Hasil Aktif</h3>
                  {attachedResultGrades.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
                      Belum ada Grade Hasil. Silakan tambahkan di bawah.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachedResultGrades.map((item) => (
                        <div key={item.id} className="group flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5 transition-colors hover:border-gray-200 hover:bg-white">
                          {editingResultGradeId === item.id ? (
                            <div className="flex w-full items-center gap-2">
                              <Input
                                className="h-7 flex-1 text-xs shadow-none"
                                value={editingResultGradeName}
                                onChange={(e) => setEditingResultGradeName(e.target.value)}
                                autoFocus
                              />
                              <Button size="sm" onClick={() => void handleSaveResultGrade()} className="h-7 px-2 text-[10px] bg-[#059833]">Simpan</Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditResultGrade} className="h-7 px-2 text-[10px] text-gray-500">Batal</Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-gray-800">{item.name}</span>
                              <div className="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                                <Button size="sm" variant="ghost" onClick={() => startEditResultGrade(item)} className="h-6 w-auto px-2 text-[10px] text-gray-500 hover:text-gray-900">
                                  Edit
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void handleDetachResultGrade(item.id)} className="h-6 w-auto px-2 text-[10px] border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                                  Lepas
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => void handleDeleteResultGrade(item)} className="h-6 w-auto px-2 text-[10px] text-red-500 hover:bg-red-50 hover:text-red-700">
                                  Hapus Global
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <Label htmlFor="result-grade-name" className="text-xs font-semibold text-gray-900">Tambah Grade Hasil ke {selectedBarangJadi.name}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="result-grade-name"
                      className={`${FIELD_CLASSNAME} h-9`}
                      value={draftResultGradeName}
                      onChange={(event) => setDraftResultGradeName(event.target.value)}
                      placeholder="Contoh: SB (C), SB (A), SB (D)..."
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleCreateAndAttachResultGrade();
                        }
                      }}
                    />
                    <Button onClick={() => void handleCreateAndAttachResultGrade()} disabled={saving} className="h-9 shrink-0 bg-[#059833] hover:bg-[#047a29]">
                      {saving ? 'Otw...' : 'Pasang'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BarangJadiPage() {
  return (
    <ProtectedRoute>
      <BarangJadiContent />
    </ProtectedRoute>
  );
}
