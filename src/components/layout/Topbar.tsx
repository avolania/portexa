"use client";

import { Bell, Search, LogOut } from "lucide-react";
import Image from "next/image";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuthStore } from "@/store/useAuthStore";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Topbar() {
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    router.push("/giris");
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Mobil logo */}
      <div className="flex md:hidden items-center gap-2 flex-1">
        <div className="w-7 h-7 rounded-lg bg-[#1a2d5a] flex items-center justify-center overflow-hidden flex-shrink-0">
          <Image src="/logo.png" alt="Portexa" width={28} height={28} unoptimized className="object-cover w-full h-full" />
        </div>
        <span className="text-sm font-bold text-[#1a2d5a]">Portexa</span>
      </div>

      {/* Search — masaüstünde göster */}
      <div className="hidden md:block flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Ara... (Ctrl+K)"
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <button
          className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          onClick={() => router.push("/bildirimler")}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Profile menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {user && <Avatar name={user.name} size="sm" />}
            <span className="hidden sm:block text-sm font-medium text-gray-700">{user?.name}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
