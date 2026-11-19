'use client';

import { usePathname } from 'next/navigation';
import { Inter } from "next/font/google";
import Image from "next/image";
import { useCallback, useRef } from 'react';
import "./globals.css";
import UserMenu from "@/components/UserMenu";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/lib/toast";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SidebarProvider, useSidebar } from "@/lib/context/SidebarContext";
import { reduceMotionInitScript } from "@/lib/motion";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

function LogoBlock() {
  const logoRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    const el = logoRef.current;
    if (!el) return;
    el.classList.remove('logo-bounce');
    // force reflow
    void el.offsetWidth;
    el.classList.add('logo-bounce');
  }, []);

  return (
    <div
      ref={logoRef}
      className="flex items-center gap-2.5 cursor-pointer select-none group"
      onClick={handleClick}
    >
      {/* Glow ring + logo */}
      <div className="relative flex h-11 w-11 items-center justify-center">
        {/* Animated gradient ring */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-emerald-300 via-lime-200 to-teal-300 opacity-80 blur-[2px] group-hover:opacity-100 group-hover:blur-[3px] transition-all duration-300 animate-[spin_6s_linear_infinite]" />
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-white/50">
          <Image
            src="/Assets/Logo-secca.png"
            alt="SECCA"
            width={36}
            height={36}
            className="h-8 w-8 object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
            priority
          />
        </div>
      </div>
      {/* Gradient text */}
      <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-lime-100 to-emerald-100 bg-clip-text text-transparent drop-shadow-sm transition-all duration-200 group-hover:tracking-widest">
        SECCA
      </span>
    </div>
  );
}

function Header() {
  const { toggleMobileMenu, isMobile } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-lg">
      <div className="h-full flex items-center justify-between px-5">
        <div className="flex items-center gap-3 pl-1">
          {/* Hamburger Menu (Mobile only) */}
          {isMobile && (
            <button
              onClick={toggleMobileMenu}
              className="p-2 -ml-2 rounded-xl hover:bg-white/10 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Logo */}
          <LogoBlock />
        </div>

        <UserMenu />
      </div>
    </header>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isMobile, isAppFullscreen } = useSidebar();

  if (isAppFullscreen) {
    return (
      <main className="min-h-screen bg-emerald-50/50">
        {children}
      </main>
    );
  }

  return (
    <main
      className={`
        mt-[72px] min-h-[calc(100vh-72px)] pb-24
        transition-all duration-300 ease-in-out
        bg-emerald-50/50
        ${isMobile ? 'ml-0' : (isCollapsed ? 'ml-20' : 'ml-64')}
      `}
    >
      {children}
    </main>
  );
}

/** Header & Sidebar dirender di sini (bukan langsung di LayoutContent) karena
 * keduanya perlu tahu isAppFullscreen, yang hidup di dalam SidebarProvider —
 * LayoutContent sendiri ada DI LUAR provider itu. */
function AppShell({ children }: { children: React.ReactNode }) {
  const { isAppFullscreen } = useSidebar();

  return (
    <>
      {!isAppFullscreen && <Header />}
      {!isAppFullscreen && <Sidebar />}
      <MainContent>{children}</MainContent>
    </>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Pages that don't need sidebar/topbar
  const publicPages = ['/login', '/register/mitra', '/not-found', '/unauthorized', '/cek'];
  const isPublicPage = publicPages.includes(pathname);

  if (isPublicPage || !isAuthenticated) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <title>SECCA</title>
        <meta name="description" content="Sistem manajemen operasional" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script dangerouslySetInnerHTML={{ __html: reduceMotionInitScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <LayoutContent>{children}</LayoutContent>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
