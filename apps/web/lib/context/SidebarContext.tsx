'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
    isCollapsed: boolean;
    isMobileOpen: boolean;
    isMobile: boolean;
    toggleSidebar: () => void;
    toggleMobileMenu: () => void;
    closeMobileMenu: () => void;
    /** Halaman (bukan cuma sidebar) minta tampil penuh layar — Header & Sidebar
     * disembunyikan total oleh RootLayout selama ini true. Dipakai oleh
     * halaman dashboard yang butuh ruang penuh (mis. /laporan-bulanan). */
    isAppFullscreen: boolean;
    setAppFullscreen: (value: boolean) => void;
    toggleAppFullscreen: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = 'secca_sidebar_collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
            return saved !== null ? JSON.parse(saved) : false;
        }
        return false;
    });
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isAppFullscreen, setAppFullscreen] = useState(false);

    // Initialize from localStorage and handle responsive
    useEffect(() => {
        // Handle responsive detection
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setIsMobileOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Persist collapsed state
    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    const toggleSidebar = () => {
        setIsCollapsed((prev: boolean) => !prev);
    };

    const toggleMobileMenu = () => {
        setIsMobileOpen((prev) => !prev);
    };

    const closeMobileMenu = () => {
        setIsMobileOpen(false);
    };

    const toggleAppFullscreen = () => {
        setAppFullscreen((prev) => !prev);
    };

    return (
        <SidebarContext.Provider
            value={{
                isCollapsed,
                isMobileOpen,
                isMobile,
                toggleSidebar,
                toggleMobileMenu,
                closeMobileMenu,
                isAppFullscreen,
                setAppFullscreen,
                toggleAppFullscreen,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
