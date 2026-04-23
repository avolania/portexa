"use client";

import { Bell, Search, LogOut, AlertCircle, ClipboardList, GitPullRequest, X } from "lucide-react";
import Image from "next/image";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";

interface SearchResult {
  id: string;
  number: string;
  title: string;
  type: "INC" | "SR" | "CR";
  state: string;
  path: string;
}

const TYPE_CONFIG = {
  INC: { label: "INC", icon: AlertCircle,    color: "text-red-600 bg-red-50",    path: "/itsm/incidents"        },
  SR:  { label: "SR",  icon: ClipboardList,  color: "text-blue-600 bg-blue-50",  path: "/itsm/service-requests" },
  CR:  { label: "CR",  icon: GitPullRequest, color: "text-violet-600 bg-violet-50", path: "/itsm/change-requests" },
};

export default function Topbar() {
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const { user, signOut } = useAuthStore();
  const { incidents }       = useIncidentStore();
  const { serviceRequests } = useServiceRequestStore();
  const { changeRequests }  = useChangeRequestStore();
  const router = useRouter();

  const [menuOpen, setMenuOpen]   = useState(false);
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<SearchResult[]>([]);
  const [showDrop, setShowDrop]   = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    window.location.href = "/giris";
  };

  const search = useCallback((q: string) => {
    const lq = q.toLowerCase().trim();
    if (lq.length < 2) { setResults([]); setShowDrop(false); return; }

    const found: SearchResult[] = [];

    for (const inc of incidents) {
      if (found.length >= 10) break;
      if (inc.shortDescription.toLowerCase().includes(lq) || inc.number.toLowerCase().includes(lq)) {
        found.push({ id: inc.id, number: inc.number, title: inc.shortDescription, type: "INC", state: inc.state, path: "/itsm/incidents" });
      }
    }
    for (const sr of serviceRequests) {
      if (found.length >= 15) break;
      if (sr.shortDescription.toLowerCase().includes(lq) || sr.number.toLowerCase().includes(lq)) {
        found.push({ id: sr.id, number: sr.number, title: sr.shortDescription, type: "SR", state: sr.state, path: "/itsm/service-requests" });
      }
    }
    for (const cr of changeRequests) {
      if (found.length >= 20) break;
      if (cr.shortDescription.toLowerCase().includes(lq) || cr.number.toLowerCase().includes(lq)) {
        found.push({ id: cr.id, number: cr.number, title: cr.shortDescription, type: "CR", state: cr.state, path: "/itsm/change-requests" });
      }
    }

    setResults(found);
    setShowDrop(true);
    setActiveIdx(-1);
  }, [incidents, serviceRequests, changeRequests]);

  useEffect(() => { search(query); }, [query, search]);

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goTo = (r: SearchResult) => {
    setShowDrop(false);
    setQuery("");
    router.push(`${r.path}?ticketId=${r.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDrop || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && activeIdx >= 0) { goTo(results[activeIdx]); }
    else if (e.key === "Escape") { setShowDrop(false); setQuery(""); }
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Mobil logo */}
      <div className="flex md:hidden items-center flex-1">
        <a href="/dashboard">
          <Image src="/logo.png" alt="Pixanto" width={100} height={32} unoptimized className="h-7 w-auto object-contain" />
        </a>
      </div>

      {/* Search */}
      <div className="hidden md:block flex-1 max-w-md relative" ref={containerRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowDrop(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Ticket ara... (Ctrl+K)"
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {query && (
            <button onClick={() => { setQuery(""); setShowDrop(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showDrop && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400 text-center">Sonuç bulunamadı</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((r, i) => {
                  const cfg = TYPE_CONFIG[r.type];
                  const Icon = cfg.icon;
                  return (
                    <li key={r.id}>
                      <button
                        onMouseDown={() => goTo(r)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${i === activeIdx ? "bg-indigo-50" : ""}`}
                      >
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${cfg.color}`}>
                          <Icon className="w-2.5 h-2.5" />
                          {r.number}
                        </span>
                        <span className="text-sm text-gray-700 truncate flex-1">{r.title}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{r.state}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
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
