'use client';

import { usePathname } from 'next/navigation';
import { Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import UserMenu from "@/components/UserMenu";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/lib/toast";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SidebarProvider, useSidebar } from "@/lib/context/SidebarContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

function Header() {
  const { toggleMobileMenu, isMobile } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#059833] text-white shadow-lg">
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
              <Image
                src="/Assets/Logo-secca.png"
                alt="SECCA"
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <span className="text-xl font-bold tracking-tight">SECCA</span>
          </div>
        </div>

        <UserMenu />
      </div>
    </header>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isMobile } = useSidebar();

  return (
    <main
      className={`
        mt-[72px] min-h-[calc(100vh-72px)]
        transition-all duration-300 ease-in-out
        bg-green-50/40
        ${isMobile ? 'ml-0' : (isCollapsed ? 'ml-20' : 'ml-64')}
      `}
    >
      {children}
    </main>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Pages that don't need sidebar/topbar
  const publicPages = ['/login', '/not-found', '/unauthorized'];
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
      <Header />
      <Sidebar />
      <MainContent>{children}</MainContent>
    </SidebarProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <title>SECCA</title>
        <meta name="description" content="Sistem manajemen operasional" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
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
