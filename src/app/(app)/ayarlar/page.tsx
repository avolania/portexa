"use client";

import { Building2, Globe, Clock, Shield, Bell, Plug } from "lucide-react";
import Link from "next/link";

const sections = [
  {
    icon: Building2,
    title: "Genel Ayarlar",
    desc: "Organizasyon adı, logo ve temel tercihler",
    color: "bg-indigo-50 text-indigo-600",
    href: "#",
  },
  {
    icon: Globe,
    title: "Dil & Bölge",
    desc: "Varsayılan dil, saat dilimi ve tarih formatı",
    color: "bg-cyan-50 text-cyan-600",
    href: "#",
  },
  {
    icon: Clock,
    title: "Çalışma Saatleri",
    desc: "Haftalık çalışma günleri ve resmi tatil takvimi",
    color: "bg-emerald-50 text-emerald-600",
    href: "#",
  },
  {
    icon: Bell,
    title: "Bildirimler",
    desc: "Uygulama içi ve e-posta bildirim tercihleri",
    color: "bg-amber-50 text-amber-600",
    href: "/profil",
  },
  {
    icon: Shield,
    title: "Güvenlik",
    desc: "Şifre politikası, 2FA ve oturum yönetimi",
    color: "bg-red-50 text-red-600",
    href: "/profil",
  },
  {
    icon: Plug,
    title: "Entegrasyonlar",
    desc: "Slack, Jira, Google Workspace ve API anahtarları",
    color: "bg-violet-50 text-violet-600",
    href: "#",
  },
];

export default function AyarlarPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>
        <p className="text-sm text-gray-500 mt-1">Organizasyon ve platform tercihlerinizi yönetin.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.title}
              href={s.href}
              className="card hover:shadow-md transition-shadow flex items-start gap-4 group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="card border-dashed border-gray-300 text-center py-8">
        <div className="text-3xl mb-2">🔧</div>
        <p className="text-sm text-gray-500">Daha fazla ayar seçeneği <strong>Faz 2</strong> ile gelecek.</p>
      </div>
    </div>
  );
}
