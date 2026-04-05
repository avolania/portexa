"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Ticket, LifeBuoy, User } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { cn } from "@/lib/utils";

function loadHelpdeskStores() {
  useAuthStore.getState().loadProfiles();
  useIncidentStore.getState().load();
  useServiceRequestStore.getState().load();
}

export default function HelpdeskLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, signOut, initAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    initAuth();

    if (useAuthStore.getState().isAuthenticated) {
      loadHelpdeskStores();
      return;
    }
    const unsub = useAuthStore.subscribe((state) => {
      if (state.isAuthenticated) {
        loadHelpdeskStores();
        unsub();
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated && !pathname.startsWith("/helpdesk/giris")) {
      router.replace("/helpdesk/giris");
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isLoginPage = pathname.startsWith("/helpdesk/giris");
  if (!isAuthenticated && !isLoginPage) return null;

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          {children}
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/helpdesk/portal",     icon: LifeBuoy, label: "Destek Portalı" },
    { href: "/helpdesk/my-tickets", icon: Ticket,   label: "Taleplerim"     },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo + brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a2d5a] flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image src="/logo.png" alt="Pixanto" width={32} height={32} unoptimized className="object-cover w-full h-full" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1a2d5a] text-sm">Pixanto</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">Helpdesk</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Kullanıcı */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{user.name}</span>
              </div>
              <button
                onClick={() => { signOut(); router.replace("/helpdesk/giris"); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Çıkış</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-gray-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
                  active ? "text-indigo-600" : "text-gray-400"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-3 text-center text-xs text-gray-400">
        Pixanto Helpdesk · Tüm hakları saklıdır
      </footer>
    </div>
  );
}
