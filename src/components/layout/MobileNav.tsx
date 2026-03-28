"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Clock, MoreHorizontal,
  Briefcase, Users, BarChart3, Settings, User, LogOut,
  ShieldCheck, AlertCircle, GitPullRequest,
  LifeBuoy, Ticket, SlidersHorizontal, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { ROLE_META } from "@/lib/permissions";

// ─── Primary tab bar items ────────────────────────────────────────────────────

const PRIMARY = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projeler",    icon: FolderKanban,    label: "Projeler"  },
  { href: "/gorevler",    icon: CheckSquare,     label: "Görevler"  },
  { href: "/aktiviteler", icon: Clock,           label: "Aktivite"  },
];

const PRIMARY_END_USER = [
  { href: "/itsm/portal",     icon: LifeBuoy, label: "Portal"    },
  { href: "/itsm/my-tickets", icon: Ticket,   label: "Taleplerim" },
];

// ─── Drawer sections ──────────────────────────────────────────────────────────

const DRAWER_SECTIONS = [
  {
    label: "Proje Yönetimi",
    items: [
      { href: "/portfolyo", icon: Briefcase,     label: "Portföy"  },
      { href: "/ekip",      icon: Users,          label: "Ekip"     },
      { href: "/raporlar",  icon: BarChart3,      label: "Raporlar" },
    ],
  },
  {
    label: "ITSM",
    items: [
      { href: "/itsm/portal",           icon: LifeBuoy,       label: "Destek Portalı"   },
      { href: "/itsm/incidents",        icon: AlertCircle,    label: "Incident'lar"      },
      { href: "/itsm/service-requests", icon: ClipboardList,  label: "Servis Talepleri"  },
      { href: "/itsm/change-requests",  icon: GitPullRequest, label: "Değişiklikler"     },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/yetkilendirme", icon: ShieldCheck,       label: "Yetkilendirme"  },
      { href: "/itsm/settings", icon: SlidersHorizontal, label: "ITSM Ayarları"  },
    ],
  },
  {
    label: "Hesap",
    items: [
      { href: "/ayarlar", icon: Settings, label: "Ayarlar" },
      { href: "/profil",  icon: User,     label: "Profil"  },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

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

  const isEndUser = user?.role === "end_user";
  const primaryItems = isEndUser ? PRIMARY_END_USER : PRIMARY;
  const allDrawerItems = DRAWER_SECTIONS.flatMap((s) => s.items);
  const isMoreActive = allDrawerItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-center safe-area-pb">
        {primaryItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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

        {!isEndUser && (
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
        )}
      </nav>

      {/* Drawer */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />

          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[80vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <Avatar name={user.name} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
                  <div className={`text-xs font-medium ${ROLE_META[user.role]?.color ?? "text-gray-500"}`}>
                    {ROLE_META[user.role]?.label ?? user.role}
                  </div>
                </div>
              </div>
            )}

            {/* Sectioned nav */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {DRAWER_SECTIONS.map((section) => (
                <div key={section.label}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
                    {section.label}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {section.items.map(({ href, icon: Icon, label }) => {
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
                </div>
              ))}
            </div>

            {/* Logout */}
            <div className="px-5 pb-6 pt-2 border-t border-gray-100 flex-shrink-0">
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
