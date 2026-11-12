'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import { getMitraOrderRequests } from '@/lib/api';
import type { UserRole, UiAccessModuleKey } from '@/lib/types/auth';
import { gsap } from 'gsap';

interface MenuItem {
    name: string;
    href?: string;
    icon: React.ReactNode;
    roles: UserRole[];
    colorClass?: string;
    children?: MenuItem[];
}

const MENU_ACCESS_REQUIREMENTS: Record<string, { moduleKey: UiAccessModuleKey; minLevel: number }> = {
    Dashboard: { moduleKey: 'dashboard', minLevel: 1 },
    Performa: { moduleKey: 'dashboard', minLevel: 1 },
    'Terima Baku': { moduleKey: 'baku', minLevel: 1 },
    'Tambah Grading': { moduleKey: 'baku', minLevel: 2 },
    'Tambah Supplier': { moduleKey: 'baku', minLevel: 3 },
    'Permintaan Order': { moduleKey: 'baku', minLevel: 1 },
    'Data Stock': { moduleKey: 'stock', minLevel: 1 },
    Rak: { moduleKey: 'stock', minLevel: 2 },
    'Pecah Bon': { moduleKey: 'stock', minLevel: 3 },
    'Daftar Mitra': { moduleKey: 'mitra_management', minLevel: 1 },
    'Tambah Mitra': { moduleKey: 'mitra_management', minLevel: 2 },
    'Pencabutan Mitra': { moduleKey: 'mitra', minLevel: 1 },
    'Order Lp untuk mitra': { moduleKey: 'trainer_orders', minLevel: 1 },
    'Board Mitra': { moduleKey: 'trainer_orders', minLevel: 2 },
    Setoran: { moduleKey: 'koreksi', minLevel: 1 },
    'Barang Jadi': { moduleKey: 'koreksi', minLevel: 2 },
    'Riwayat Setoran': { moduleKey: 'koreksi', minLevel: 3 },
    Laporan: { moduleKey: 'reports', minLevel: 1 },
    Presensi: { moduleKey: 'reports', minLevel: 1 },
    Pengaturan: { moduleKey: 'settings', minLevel: 1 },
    'Manajemen Data': { moduleKey: 'admin', minLevel: 1 },
    'Manajemen Akun': { moduleKey: 'admin', minLevel: 2 },
    'Assign Pengawas': { moduleKey: 'admin', minLevel: 3 },
    'Manajemen Rak': { moduleKey: 'admin', minLevel: 1 },
    'Ruang Produksi': { moduleKey: 'admin', minLevel: 1 },
};

const menuItems: MenuItem[] = [
    // Dashboard - hijau emerald
    {
        name: 'Dashboard',
        href: '/dashboard',
        colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
        roles: ['mitra', 'koreksi', 'manager', 'trainer'],
    },
    // Performa Dashboard - warna teal / cyan
    {
        name: 'Performa',
        href: '/performa',
        colorClass: 'bg-teal-100 text-teal-700 border-teal-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        roles: ['manager', 'trainer'],
    },
    // Menu Baku - warna amber / oranye
    {
        name: 'Baku',
        colorClass: 'bg-amber-100 text-amber-700 border-amber-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        roles: ['baku', 'manager'],
        children: [
            {
                name: 'Terima Baku',
                href: '/baku/receive',
                colorClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 4v16m8-8H4" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Tambah Grading',
                href: '/baku/grading',
                colorClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 022 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Tambah Supplier',
                href: '/baku/supplier',
                colorClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Permintaan Order',
                href: '/baku/orders',
                colorClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
        ],
    },
    // Menu Stock - warna biru
    {
        name: 'Stock',
        colorClass: 'bg-blue-100 text-blue-700 border-blue-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
        ),
        roles: ['baku', 'manager'],
        children: [
            {
                name: 'Data Stock',
                href: '/stock',
                colorClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Rak',
                href: '/stock/rak',
                colorClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Pecah Bon',
                href: '/stock/pecah-bon',
                colorClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
        ],
    },
    // Menu Mitra - warna indigo / nila
    {
        name: 'Daftar Mitra',
        href: '/mitra/list',
        colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
        roles: ['trainer', 'manager'],
    },
    {
        name: 'Tambah Mitra',
        href: '/mitra/add',
        colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
        ),
        roles: ['trainer', 'manager'],
    },
    {
        name: 'Pencabutan Mitra',
        href: '/mitra/board',
        colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        roles: ['mitra'],
    },
    {
        name: 'Order Mitra',
        colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 4l8 4-8 4-8-4 8-4z" />
                <path d="M4 12v6l8 4 8-4v-6" />
            </svg>
        ),
        roles: ['trainer', 'manager'],
        children: [
            {
                name: 'Order Lp untuk mitra',
                href: '/trainer/orders',
                colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 5v14m7-7H5" />
                    </svg>
                ),
                roles: ['trainer', 'manager'],
            },
            {
                name: 'Board Mitra',
                href: '/trainer/board',
                colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                ),
                roles: ['trainer', 'manager'],
            },
        ],
    },
    // Menu Setoran - warna teal / cyan
    {
        name: 'Setoran',
        href: '/koreksi/data',
        colorClass: 'bg-teal-100 text-teal-700 border-teal-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        ),
        roles: ['koreksi', 'manager'],
    },
    {
        name: 'Barang Jadi',
        href: '/koreksi/barang-jadi',
        colorClass: 'bg-teal-100 text-teal-700 border-teal-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        roles: ['koreksi', 'manager'],
    },
    {
        name: 'Riwayat Setoran',
        href: '/koreksi/history',
        colorClass: 'bg-teal-100 text-teal-700 border-teal-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        roles: ['koreksi', 'manager'],
    },
    // Menu Manager - warna ungu / purple
    {
        name: 'Laporan',
        href: '/reports',
        colorClass: 'bg-purple-100 text-purple-700 border-purple-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        roles: ['manager'],
    },
    {
        name: 'Presensi',
        href: '/presensi',
        colorClass: 'bg-purple-100 text-purple-700 border-purple-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        roles: ['manager'],
    },
    {
        name: 'Pengaturan',
        href: '/settings',
        colorClass: 'bg-slate-100 text-slate-700 border-slate-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        roles: ['manager'],
    },
    // Admin menu - warna rose / merah muda
    {
        name: 'Admin',
        colorClass: 'bg-rose-100 text-rose-700 border-rose-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
        ),
        roles: ['manager'],
        children: [
            {
                name: 'Manajemen Data',
                href: '/admin/rules',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                ),
                roles: ['manager'],
            },
            {
                name: 'Manajemen Akun',
                href: '/admin/users',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
                        <path d="M12 15c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                    </svg>
                ),
                roles: ['manager'],
            },
            {
                name: 'Assign Pengawas',
                href: '/admin/mitra-pengawas',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857" />
                        <path d="M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857" />
                        <path d="M7 20H2v-2a3 3 0 015.356-1.857" />
                        <path d="M7 20v-2c0-.656.126-1.283.356-1.857" />
                        <path d="M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                ),
                roles: ['manager'],
            },
            {
                name: 'Manajemen Rak',
                href: '/admin/locations',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                ),
                roles: ['manager', 'baku'],
            },
            {
                name: 'Ruang Produksi',
                href: '/admin/rooms',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                ),
                roles: ['manager', 'baku'],
            },
        ],
    },
    // Laporan Bulanan (audit) - warna indigo, khusus role admin (bukan
    // module-based seperti item lain, sengaja dicek langsung dari user.role
    // karena tidak ada entry-nya di MENU_ACCESS_REQUIREMENTS).
    {
        name: 'Laporan Bulanan',
        href: '/laporan-bulanan',
        colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200/70',
        icon: (
            <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 17v-2m3 2v-4m3 4v-6M6 21h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
        roles: ['admin'],
    },
];

function Tooltip({ children, label, show }: { children: React.ReactNode; label: string; show: boolean }) {
    if (!show) return <>{children}</>;

    return (
        <div className="relative group">
            {children}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                {label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
        </div>
    );
}

export default function Sidebar() {
    const pathname = usePathname();
    const { user, hasModuleAccess } = useAuth();
    const { isCollapsed, isMobileOpen, isMobile, toggleSidebar, closeMobileMenu } = useSidebar();
    const [openMenus, setOpenMenus] = useState<string[]>([]);
    const navRef = useRef<HTMLElement>(null);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);

    // Notification states
    const [pendingBakuCount, setPendingBakuCount] = useState(0);
    const [fulfilledTrainerCount, setFulfilledTrainerCount] = useState(0);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const userRole = user.role.toLowerCase();
            
            // 1. Baku / Manager: REQUESTED requests waiting for approval/split
            if (userRole === 'baku' || userRole === 'manager') {
                const reqs = await getMitraOrderRequests({ status: 'REQUESTED', limit: 100 });
                setPendingBakuCount(reqs.length);
            } else {
                setPendingBakuCount(0);
            }

            // 2. Trainer / Manager: FULFILLED requests since last visited
            if (userRole === 'trainer' || userRole === 'manager') {
                const reqs = await getMitraOrderRequests({ status: 'FULFILLED', limit: 100 });
                const lastVisitedStr = localStorage.getItem('secca_last_visited_trainer_orders');
                
                if (lastVisitedStr) {
                    const lastVisited = new Date(lastVisitedStr).getTime();
                    const unread = reqs.filter(r => new Date(r.updatedAt).getTime() > lastVisited);
                    setFulfilledTrainerCount(unread.length);
                } else {
                    // Default: show requests fulfilled in the last 24 hours
                    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                    const unread = reqs.filter(r => new Date(r.updatedAt).getTime() > oneDayAgo);
                    setFulfilledTrainerCount(unread.length);
                }
            } else {
                setFulfilledTrainerCount(0);
            }
        } catch (error) {
            console.error('Error fetching sidebar notifications:', error);
        }
    };

    // Polling notifications
    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Clear notifications on visiting orders page
    useEffect(() => {
        if (pathname === '/trainer/orders') {
            localStorage.setItem('secca_last_visited_trainer_orders', new Date().toISOString());
            setFulfilledTrainerCount(0);
        }
    }, [pathname]);

    // Animate menu items on mount
    useEffect(() => {
        if (navRef.current && !isMobile) {
            const items = navRef.current.querySelectorAll('.menu-item');
            gsap.fromTo(
                items,
                { opacity: 0, x: -20 },
                {
                    opacity: 1,
                    x: 0,
                    duration: 0.4,
                    stagger: 0.05,
                    ease: 'power2.out',
                    delay: 0.1
                }
            );
        }
    }, [isMobile]);

    if (!user) return null;

    const isMenuVisible = (item: MenuItem): boolean => {
        if (item.children && item.children.length > 0) {
            return item.children.some((child) => isMenuVisible(child));
        }

        const accessRequirement = MENU_ACCESS_REQUIREMENTS[item.name];
        if (accessRequirement) {
            return hasModuleAccess(accessRequirement.moduleKey, accessRequirement.minLevel);
        }

        const userRole = (user.role?.toLowerCase() ?? '') as UserRole;
        return item.roles.map((r) => r.toLowerCase()).includes(userRole);
    };

    const visibleMenuItems = menuItems.filter((item) => isMenuVisible(item));

    const toggleMenu = (menuName: string) => {
        setOpenMenus((prev) =>
            prev.includes(menuName)
                ? prev.filter((name) => name !== menuName)
                : [...prev, menuName]
        );
    };

    const handleItemClick = (e: React.MouseEvent<HTMLElement>) => {
        const target = e.currentTarget;
        target.classList.remove('menu-click-anim');
        void target.offsetWidth;
        target.classList.add('menu-click-anim');
        if (isMobile) {
            closeMobileMenu();
        }
    };

    const renderMenuItem = (item: MenuItem, isChild = false) => {
        const hasChildren = item.children && item.children.length > 0;
        const isOpen = openMenus.includes(item.name);
        const isActive = item.href ? pathname === item.href : false;
        const showTooltip = false;
        const defaultColorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200/70';

        // Get notification badge count and colors
        let badgeCount = 0;
        let badgeColor = 'bg-rose-500 text-white border-rose-600';
        if (item.name === 'Stock' || item.name === 'Data Stock') {
            badgeCount = pendingBakuCount;
            badgeColor = 'bg-amber-500 text-white border-amber-600 animate-pulse-subtle';
        } else if (item.name === 'Order Mitra' || item.name === 'Order Lp untuk mitra') {
            badgeCount = fulfilledTrainerCount;
            badgeColor = 'bg-emerald-500 text-white border-emerald-600';
        }

        if (hasChildren) {
            // Parent menu with children (dropdown)
            const isAnyChildActive = item.children?.some(child => pathname === child.href);
            const handleParentClick = (e: React.MouseEvent<HTMLButtonElement>) => {
                handleItemClick(e);
                if (isCollapsed && !isMobile) {
                    toggleSidebar();
                    setOpenMenus((prev) => (prev.includes(item.name) ? prev : [...prev, item.name]));
                    return;
                }
                toggleMenu(item.name);
            };

            return (
                <div key={item.name} className="menu-item">
                    <Tooltip label={item.name} show={showTooltip}>
                        <button
                            onClick={handleParentClick}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`
                                flex items-center w-full rounded-xl transition-all duration-200 active:scale-95 will-change-transform
                                ${isCollapsed && !isMobile ? 'justify-center px-2.5 py-2.5' : 'justify-between px-3 py-2.5'}
                                ${isAnyChildActive
                                    ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-50/80 text-emerald-700 font-semibold border border-emerald-400/30 shadow-xs'
                                    : 'text-gray-700 hover:bg-emerald-50/60 hover:text-emerald-700'
                                }
                                ${hoveredItem === item.name ? 'scale-[1.02]' : ''}
                            `}
                        >
                            <div className={`flex items-center ${isCollapsed && !isMobile ? '' : 'gap-3'}`}>
                                <span className="relative">
                                    <span className={`
                                        flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 border
                                        ${isAnyChildActive
                                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                                            : (item.colorClass ?? defaultColorClass)
                                        }
                                        ${hoveredItem === item.name && !isAnyChildActive ? 'scale-110' : ''}
                                    `}>
                                        {item.icon}
                                    </span>
                                    {isCollapsed && !isMobile && badgeCount > 0 && (
                                        <span className={`absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full border border-white ${badgeColor.split(' ')[0]}`} />
                                    )}
                                </span>
                                {(!isCollapsed || isMobile) && (
                                    <span className="font-medium text-sm">{item.name}</span>
                                )}
                            </div>
                            {(!isCollapsed || isMobile) && (
                                <div className="flex items-center gap-1.5">
                                    {badgeCount > 0 && (
                                        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold border ${badgeColor}`}>
                                            {badgeCount}
                                        </span>
                                    )}
                                    <svg
                                        className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : 'text-gray-400'}`}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    </Tooltip>

                    {/* Dropdown children with animation */}
                    {isOpen && (!isCollapsed || isMobile) && (
                        <div className="mt-1 ml-3 pl-2.5 border-l-2 border-emerald-300/70 space-y-1">
                            {(item.children ?? [])
                                .filter((child) => isMenuVisible(child))
                                .map((child) => renderMenuItem(child, true))}
                        </div>
                    )}
                </div>
            );
        }

        // Regular menu item (with link)
        if (item.href) {
            return (
                <div key={item.name} className="menu-item">
                    <Tooltip label={item.name} show={showTooltip}>
                        <Link
                            href={item.href}
                            onClick={handleItemClick}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`
                                relative flex items-center rounded-xl transition-all duration-200 active:scale-95 will-change-transform
                                ${isCollapsed && !isMobile && !isChild ? 'justify-center px-2.5 py-2.5' : 'px-3 py-2.5 gap-3'}
                                ${isChild ? 'text-sm py-2' : ''}
                                ${isActive
                                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-500/30'
                                    : 'text-gray-700 hover:bg-emerald-50/60 hover:text-emerald-700'
                                }
                                ${hoveredItem === item.name && !isActive ? 'scale-[1.02] bg-emerald-50/40' : ''}
                            `}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full shadow-sm" />
                            )}
                            <span className="relative">
                                <span className={`
                                    flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 border
                                    ${isActive
                                        ? 'bg-white/20 text-white border-white/30 shadow-none'
                                        : (item.colorClass ?? defaultColorClass)
                                    }
                                    ${hoveredItem === item.name && !isActive ? 'scale-110' : ''}
                                `}>
                                    {item.icon}
                                </span>
                                {isCollapsed && !isMobile && !isChild && badgeCount > 0 && (
                                    <span className={`absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full border border-white ${badgeColor.split(' ')[0]}`} />
                                )}
                            </span>
                            {(!isCollapsed || isMobile || isChild) && (
                                <span className="font-medium text-sm">{item.name}</span>
                            )}
                            {(!isCollapsed || isMobile || isChild) && badgeCount > 0 && (
                                <span className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold border ${badgeColor}`}>
                                    {badgeCount}
                                </span>
                            )}
                        </Link>
                    </Tooltip>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            {/* Mobile Overlay Backdrop */}
            {isMobile && isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed top-[72px] bottom-0 left-0 z-40
                    bg-white/95 backdrop-blur-xl
                    border-r border-emerald-200/60
                    transition-all duration-300 ease-in-out
                    flex flex-col
                    ${isCollapsed && !isMobile ? 'w-20' : 'w-64'}
                    ${isMobile ? (isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full') : 'translate-x-0'}
                `}
            >
                {/* Collapse Toggle Button (Desktop only) */}
                {!isMobile && (
                    <button
                        onClick={toggleSidebar}
                        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all duration-200 z-10"
                    >
                        <svg
                            className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {/* Navigation */}
                <nav ref={navRef} className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin">
                    {visibleMenuItems.map((item) => renderMenuItem(item, false))}
                </nav>

                {/* Footer */}
                <div className={`
                    p-4 border-t border-gray-100
                    ${isCollapsed && !isMobile ? 'px-2' : ''}
                `}>
                    <div className={`
                        flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50
                        ${isCollapsed && !isMobile ? 'justify-center' : ''}
                    `}>
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-emerald-500/30">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        {(!isCollapsed || isMobile) && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
