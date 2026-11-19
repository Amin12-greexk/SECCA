/**
 * Pengaturan animasi aplikasi.
 *
 * Dulu animasi dimatikan total kalau browser melapor
 * `prefers-reduced-motion: reduce`. Di Windows itu terjadi setiap kali setelan
 * "Show animations in Windows" (Ease of Access / Visual effects) mati — sering
 * mati bawaan di laptop kantor atau mode hemat daya — sehingga di Windows
 * animasi tidak tampil sama sekali, sedangkan di Mac tampil normal.
 *
 * Sekarang animasi aplikasi (fade/slide kecil, grafik) selalu menyala dan
 * tidak lagi mengikuti setelan OS. Pengguna yang memang butuh tanpa animasi
 * bisa mematikannya per perangkat:
 *   localStorage.setItem('secca:reduce-motion', '1')  // lalu refresh
 * Flag ini dipasang sebagai `data-reduce-motion="true"` di <html>.
 */
export const REDUCE_MOTION_STORAGE_KEY = 'secca:reduce-motion';

export function prefersReducedMotion(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.reduceMotion === 'true';
}

/** Skrip kecil di <head> agar flag terpasang sebelum halaman dirender. */
export const reduceMotionInitScript = `try{if(localStorage.getItem('${REDUCE_MOTION_STORAGE_KEY}')==='1')document.documentElement.dataset.reduceMotion='true'}catch(e){}`;
