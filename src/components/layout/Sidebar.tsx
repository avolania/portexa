"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Briefcase, CheckSquare,
  Users, Clock, DollarSign, FileText, BarChart3,
  Bell, MessageSquare, Settings, User, ChevronLeft,
  ChevronRight, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_META } from "@/lib/permissions";
import Avatar from "@/components/ui/Avatar";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projeler", icon: FolderKanban, label: "Projeler" },
  { href: "/portfolyo", icon: Briefcase, label: "Portföy" },
  { href: "/gorevler", icon: CheckSquare, label: "Görevler" },
  { href: "/ekip", icon: Users, label: "Ekip" },
  { href: "/zaman-takibi", icon: Clock, label: "Zaman Takibi" },
  { href: "/butce", icon: DollarSign, label: "Bütçe" },
  { href: "/dosyalar", icon: FileText, label: "Dosyalar" },
  { href: "/raporlar", icon: BarChart3, label: "Raporlar" },
  { href: "/yetkilendirme", icon: ShieldCheck, label: "Yetkilendirme" },
];

const bottomItems = [
  { href: "/bildirimler", icon: Bell, label: "Bildirimler" },
  { href: "/mesajlar", icon: MessageSquare, label: "Mesajlar" },
  { href: "/ayarlar", icon: Settings, label: "Ayarlar" },
  { href: "/profil", icon: User, label: "Profil" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-200 relative",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-gray-100">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#1a2d5a] flex items-center justify-center overflow-hidden">
          <Image
            src="/logo.png"
            alt="Portexa"
            width={36}
            height={36}
            unoptimized
            className="object-cover w-full h-full"
          />
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-[#1a2d5a] truncate">Portexa</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "sidebar-item",
                active && "active",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="border-t border-gray-100 py-4 px-3 space-y-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "sidebar-item",
                active && "active",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User info */}
      {user && (
        <div className={cn(
          "border-t border-gray-100 p-4 flex items-center gap-3",
          collapsed && "justify-center"
        )}>
          <Avatar name={user.name} size="md" className="flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
              <div className={`text-xs font-medium mt-0.5 ${ROLE_META[user.role]?.color ?? "text-gray-500"}`}>
                {ROLE_META[user.role]?.label ?? user.role}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>
    </aside>
  );
}
