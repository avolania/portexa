"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Briefcase, CheckSquare,
  Users, Clock, DollarSign, FileText, BarChart3,
  Bell, MessageSquare, Settings, User, ChevronLeft,
  ChevronRight, ShieldCheck, ClipboardList, HeadphonesIcon,
  AlertCircle, GitPullRequest, LifeBuoy, Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_META } from "@/lib/permissions";
import Avatar from "@/components/ui/Avatar";
import { useState } from "react";

// ─── End-user nav (sadece portal + taleplerim) ────────────────────────────────

const endUserNav = [
  { href: "/itsm/portal",      icon: LifeBuoy, label: "Destek Portalı" },
  { href: "/itsm/my-tickets",  icon: Ticket,   label: "Taleplerim"     },
];

// ─── Nav sections ─────────────────────────────────────────────────────────────

const navSections = [
  {
    label: "Genel",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    label: "Proje Yönetimi",
    items: [
      { href: "/projeler",     icon: FolderKanban, label: "Projeler"    },
      { href: "/portfolyo",    icon: Briefcase,    label: "Portföy"     },
      { href: "/gorevler",     icon: CheckSquare,  label: "Görevler"    },
      { href: "/ekip",         icon: Users,        label: "Ekip"        },
      { href: "/aktiviteler",  icon: Clock,        label: "Aktiviteler" },
      { href: "/butce",        icon: DollarSign,   label: "Bütçe"       },
      { href: "/dosyalar",     icon: FileText,     label: "Dosyalar"    },
      { href: "/raporlar",     icon: BarChart3,    label: "Raporlar"    },
      { href: "/talepler",     icon: ClipboardList, label: "Talepler"   },
    ],
  },
  {
    label: "ITSM",
    items: [
      { href: "/itsm",                   icon: HeadphonesIcon, label: "ITSM Dashboard"       },
      { href: "/itsm/portal",            icon: LifeBuoy,       label: "Destek Portalı"       },
      { href: "/itsm/incidents",         icon: AlertCircle,    label: "Incident'lar"          },
      { href: "/itsm/service-requests",  icon: ClipboardList,  label: "Servis Talepleri"      },
      { href: "/itsm/change-requests",   icon: GitPullRequest, label: "Değişiklik Talepleri"  },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/yetkilendirme", icon: ShieldCheck, label: "Yetkilendirme" },
    ],
  },
];

const bottomItems = [
  { href: "/bildirimler", icon: Bell,          label: "Bildirimler" },
  { href: "/mesajlar",    icon: MessageSquare, label: "Mesajlar"    },
  { href: "/ayarlar",     icon: Settings,      label: "Ayarlar"     },
  { href: "/profil",      icon: User,          label: "Profil"      },
];

// ─── Component ────────────────────────────────────────────────────────────────

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
          <Image src="/logo.png" alt="Portexa" width={36} height={36} unoptimized className="object-cover w-full h-full" />
        </div>
        {!collapsed && <span className="text-base font-bold text-[#1a2d5a] truncate">Portexa</span>}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {user?.role === "end_user" ? (
          <div className="space-y-0.5">
            {endUserNav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("sidebar-item", active && "active", collapsed && "justify-center px-2")}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ) : (
          navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === "/itsm"
                    ? pathname === "/itsm"
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("sidebar-item", active && "active", collapsed && "justify-center px-2")}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Bottom items */}
      <div className="border-t border-gray-100 py-3 px-3 space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-item", active && "active", collapsed && "justify-center px-2")}
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
        <div className={cn("border-t border-gray-100 p-4 flex items-center gap-3", collapsed && "justify-center")}>
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
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          : <ChevronLeft  className="w-3.5 h-3.5 text-gray-500" />
        }
      </button>
    </aside>
  );
}
