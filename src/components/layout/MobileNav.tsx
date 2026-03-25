"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Clock, MoreHorizontal, X,
  Briefcase, Users, DollarSign, FileText, BarChart3, ShieldCheck,
  Bell, Settings, User, LogOut, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { ROLE_META } from "@/lib/permissions";

const PRIMARY = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projeler",  icon: FolderKanban,    label: "Projeler"  },
  { href: "/gorevler",  icon: CheckSquare,      label: "Görevler"  },
  { href: "/aktiviteler", icon: Clock,          label: "Aktivite"  },
];

const MORE_ITEMS = [
  { href: "/portfolyo",    icon: Briefcase,  label: "Portföy"       },
  { href: "/ekip",         icon: Users,      label: "Ekip"          },
  { href: "/butce",        icon: DollarSign, label: "Bütçe"         },
  { href: "/dosyalar",     icon: FileText,   label: "Dosyalar"      },
  { href: "/raporlar",     icon: BarChart3,  label: "Raporlar"      },
  { href: "/yetkilendirme",icon: ShieldCheck,  label: "Yetkilendirme" },
  { href: "/talepler",     icon: ClipboardList, label: "Talepler"      },
  { href: "/bildirimler",  icon: Bell,       label: "Bildirimler"   },
  { href: "/ayarlar",      icon: Settings,   label: "Ayarlar"       },
  { href: "/profil",       icon: User,       label: "Profil"        },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    setOpen(false);
    signOut();
    router.push("/giris");
  };

  const isMoreActive = MORE_ITEMS.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* Bottom tab bar — only on mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-center safe-area-pb">
        {PRIMARY.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                active ? "text-indigo-600" : "text-gray-400"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
            isMoreActive ? "text-indigo-600" : "text-gray-400"
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">Daha Fazla</span>
        </button>
      </nav>

      {/* More drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                <Avatar name={user.name} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
                  <div className={`text-xs font-medium ${ROLE_META[user.role]?.color ?? "text-gray-500"}`}>
                    {ROLE_META[user.role]?.label ?? user.role}
                  </div>
                </div>
              </div>
            )}

            {/* Nav grid */}
            <div className="grid grid-cols-3 gap-1 px-3 py-3">
              {MORE_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors",
                      active ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Logout */}
            <div className="px-5 pb-6 pt-2 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Çıkış Yap
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
