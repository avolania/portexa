"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import MobileNav from "@/components/layout/MobileNav";
import ChatBot from "@/components/ChatBot";
import { useAuthStore } from "@/store/useAuthStore";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, signOut } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/giris");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // signOut kullanılmıyor ama import'un tree-shaking'den kaldırılmaması için
  void signOut;

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-gray-50 pb-20 md:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
      <ChatBot />
    </>
  );
}
