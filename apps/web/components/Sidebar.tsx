'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import type { UserRole } from '@/lib/types/auth';
import { gsap } from 'gsap';

interface MenuItem {
    name: string;
    href?: string;
    icon: React.ReactNode;
    roles: UserRole[];
    children?: MenuItem[];
}

const menuItems: MenuItem[] = [
    // Dashboard - untuk semua role KECUALI baku
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
        roles: ['mitra', 'koreksi', 'manager', 'trainer'],
    },
    // Menu Baku (dengan dropdown) - khusus role baku dan manager
    {
        name: 'Baku',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
        roles: ['baku', 'manager'],
        children: [
            {
                name: 'Terima Baku',
                href: '/baku/receive',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 4v16m8-8H4" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Tambah Grading',
                href: '/baku/grading',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Tambah Supplier',
                href: '/baku/supplier',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
        ],
    },
    // Menu Stock (dengan dropdown) - khusus role baku dan manager
    {
        name: 'Stock',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
        ),
        roles: ['baku', 'manager'],
        children: [
            {
                name: 'Data Stock',
                href: '/stock',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
            {
                name: 'Rak',
                href: '/stock/rak',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                ),
                roles: ['baku', 'manager'],
            },
        ],
    },
    // Menu Mitra
    {
        name: 'Daftar Mitra',
        href: '/mitra/list',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
        roles: ['trainer', 'manager'],
    },
    {
        name: 'Tambah Mitra',
        href: '/mitra/add',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
        ),
        roles: ['trainer', 'manager'],
    },
    {
        name: 'Pekerjaan Mitra',
        href: '/mitra/board',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        roles: ['mitra'],
    },
    {
        name: 'Pengawas',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 4l8 4-8 4-8-4 8-4z" />
                <path d="M4 12v6l8 4 8-4v-6" />
            </svg>
        ),
        roles: ['trainer', 'manager'],
        children: [
            {
                name: 'Order Mitra',
                href: '/trainer/orders',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 5v14m7-7H5" />
                    </svg>
                ),
                roles: ['trainer', 'manager'],
            },
            {
                name: 'Board Mitra',
                href: '/trainer/board',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                ),
                roles: ['trainer', 'manager'],
            },
        ],
    },
    // Menu Koreksi
    {
        name: 'Data Koreksi',
        href: '/koreksi/data',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        ),
        roles: ['koreksi', 'manager'],
    },
    {
        name: 'Riwayat Koreksi',
        href: '/koreksi/history',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        roles: ['koreksi', 'manager'],
    },
    // Menu Manager only
    {
        name: 'Laporan',
        href: '/reports',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        roles: ['manager'],
    },
    {
        name: 'Pengaturan',
        href: '/settings',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        roles: ['manager'],
    },
    // Admin menu
    {
        name: 'Admin',
        icon: (
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
        ),
        roles: ['manager'],
        children: [
            {
                name: 'Manajemen Data',
                href: '/admin/rules',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                ),
                roles: ['manager'],
            },
            {
                name: 'Manajemen Akun',
                href: '/admin/users',
                icon: (
                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
                        <path d="M12 15c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                    </svg>
                ),
                roles: ['manager'],
            },
        ],
    },
];

// Tooltip Component
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
    const { user } = useAuth();
    const { isCollapsed, isMobileOpen, isMobile, toggleSidebar, closeMobileMenu } = useSidebar();
    const [openMenus, setOpenMenus] = useState<string[]>([]);
    const navRef = useRef<HTMLElement>(null);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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

    // Filter menu items based on user role
    const visibleMenuItems = menuItems.filter((item) =>
        item.roles.includes(user.role as UserRole)
    );

    const toggleMenu = (menuName: string) => {
        setOpenMenus((prev) =>
            prev.includes(menuName)
                ? prev.filter((name) => name !== menuName)
                : [...prev, menuName]
        );
    };

    const handleLinkClick = () => {
        if (isMobile) {
            closeMobileMenu();
        }
    };

    const renderMenuItem = (item: MenuItem, isChild = false, index = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const isOpen = openMenus.includes(item.name);
        const isActive = item.href ? pathname === item.href : false;
        const showTooltip = false;

        if (hasChildren) {
            // Parent menu with children (dropdown)
            const isAnyChildActive = item.children?.some(child => pathname === child.href);
            const handleParentClick = () => {
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
                                flex items-center w-full rounded-xl transition-all duration-200
                                ${isCollapsed && !isMobile ? 'justify-center px-3 py-3' : 'justify-between px-4 py-3'}
                                ${isAnyChildActive
                                    ? 'bg-green-100 text-[#059833] shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                                ${hoveredItem === item.name ? 'scale-[1.02]' : ''}
                            `}
                        >
                            <div className={`flex items-center ${isCollapsed && !isMobile ? '' : 'gap-3'}`}>
                                <span className={`
                                    flex-shrink-0 transition-colors duration-200
                                    ${isAnyChildActive ? 'text-[#059833]' : 'text-gray-400 group-hover:text-gray-600'}
                                `}>
                                    {item.icon}
                                </span>
                                {(!isCollapsed || isMobile) && (
                                    <span className="font-medium">{item.name}</span>
                                )}
                            </div>
                            {(!isCollapsed || isMobile) && (
                                <svg
                                    className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path d="M19 9l-7 7-7-7" />
                                </svg>
                            )}
                        </button>
                    </Tooltip>

                    {/* Dropdown children with animation */}
                    {isOpen && (!isCollapsed || isMobile) && (
                        <div className="mt-1 ml-4 pl-4 border-l-2 border-gray-100 space-y-1">
                            {(item.children ?? [])
                                .filter((child) => child.roles.includes(user.role as UserRole))
                                .map((child, childIndex) => renderMenuItem(child, true, childIndex))}
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
                            onClick={handleLinkClick}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`
                                flex items-center rounded-xl transition-all duration-200
                                ${isCollapsed && !isMobile && !isChild ? 'justify-center px-3 py-3' : 'px-4 py-3 gap-3'}
                                ${isChild ? 'text-sm' : ''}
                                ${isActive
                                    ? 'bg-[#059833] text-white shadow-lg shadow-[rgba(5,152,51,0.25)]'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                                ${hoveredItem === item.name && !isActive ? 'scale-[1.02]' : ''}
                            `}
                        >
                            <span className={`
                                flex-shrink-0 transition-colors duration-200
                                ${isActive ? 'text-white' : 'text-gray-400'}
                            `}>
                                {item.icon}
                            </span>
                            {(!isCollapsed || isMobile || isChild) && (
                                <span className="font-medium">{item.name}</span>
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
                    border-r border-gray-200/80
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
                    {visibleMenuItems.map((item, index) => renderMenuItem(item, false, index))}
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
                        <div className="w-8 h-8 bg-[#059833] rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-[rgba(5,152,51,0.25)]">
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
