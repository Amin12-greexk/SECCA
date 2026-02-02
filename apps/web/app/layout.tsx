'use client';

import { usePathname } from 'next/navigation';
import { Inter } from "next/font/google";
import "./globals.css";
import LogoPlaceholder from "@/components/LogoPlaceholder";
import UserMenu from "@/components/UserMenu";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/lib/toast";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Pages that don't need sidebar/topbar
  const publicPages = ['/login', '/not-found', '/unauthorized'];
  const isPublicPage = publicPages.includes(pathname);

  return (
    <>
      {!isPublicPage && isAuthenticated && (
        <>
          {/* Topbar */}
          <header className="bg-green-600 text-white shadow-md fixed top-0 left-0 right-0 z-40">
            <div className="px-4 py-4 flex items-center justify-between">
              <LogoPlaceholder textClassName="text-white" />
              <UserMenu />
            </div>
          </header>

          {/* Sidebar */}
          <div className="fixed top-[72px] left-0 bottom-0 z-30">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main Content */}
      <main
        className={
          !isPublicPage && isAuthenticated
            ? "ml-64 mt-[72px] min-h-[calc(100vh-72px)]"
            : "min-h-screen"
        }
      >
        {children}
      </main>
    </>
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
        <title>SECCA - Sistem Manajemen Baku</title>
        <meta name="description" content="Aplikasi manajemen penerimaan bahan baku" />
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
