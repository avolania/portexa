"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/store/useAuthStore";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/giris");
      return;
    }
    // "Beni hatırla" seçilmemişse sessionStorage yoktur — sadece aynı sekmede geçerli
    // Not: Next.js dev server yeniden başlatması sekmeyi kapatmaz,
    // bu yüzden sadece gerçek yeni sekme/tarayıcı açılışlarında oturum biter.
    if (user?.rememberMe === false) {
      const hasSession = sessionStorage.getItem("portexa-session");
      if (!hasSession) {
        // sessionStorage yoksa oturumu kapat ama veri kaybolmasın (logout artık user'ı silmiyor)
        logout();
        router.push("/giris");
      }
    }
  }, [isAuthenticated, user?.rememberMe, logout, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
