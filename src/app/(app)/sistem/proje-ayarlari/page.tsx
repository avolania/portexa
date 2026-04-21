"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, Save, CheckCircle2, RotateCcw } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEFAULT_PROJECT_ROLES } from "@/services/settingsService";
import { cn } from "@/lib/utils";

export default function ProjeAyarlariPage() {
  const { settings, update } = useSettingsStore();

  const [roles, setRoles] = useState<string[]>(
    settings.projectRoles?.length ? settings.projectRoles : DEFAULT_PROJECT_ROLES
  );
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const original = settings.projectRoles?.length ? settings.projectRoles : DEFAULT_PROJECT_ROLES;
  const dirty = JSON.stringify(roles) !== JSON.stringify(original);

  const addRole = () => {
    const trimmed = newRole.trim();
    if (!trimmed || roles.includes(trimmed)) return;
    setRoles((prev) => [...prev, trimmed]);
    setNewRole("");
    setSaved(false);
  };

  const removeRole = (idx: number) => {
    setRoles((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const updateRole = (idx: number, value: string) => {
    setRoles((prev) => prev.map((r, i) => (i === idx ? value : r)));
    setSaved(false);
  };

  const moveRole = (idx: number, dir: -1 | 1) => {
    const next = [...roles];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setRoles(next);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await update({ projectRoles: roles });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setRoles(DEFAULT_PROJECT_ROLES);
    setSaved(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Proje Ayarları</h1>
        <p className="text-sm text-gray-500 mt-1">
          Proje ekibine atanabilecek rolleri ve diğer proje bakım ayarlarını buradan yönetin.
        </p>
      </div>

      {/* Proje Rolleri */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Proje Rolleri</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ekip sekmesindeki "Proje rolü" dropdown'ında görünecek roller.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Kaydedildi
              </span>
            )}
            <button
              onClick={handleReset}
              title="Varsayılanlara döndür"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        {/* Rol listesi */}
        <div className="divide-y divide-gray-100">
          {roles.map((role, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 group transition-colors",
                dragIdx === idx ? "bg-indigo-50" : "hover:bg-gray-50/60"
              )}
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveRole(idx, -1)}
                  disabled={idx === 0}
                  className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveRole(idx, 1)}
                  disabled={idx === roles.length - 1}
                  className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"
                >
                  ▼
                </button>
              </div>

              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

              <input
                value={role}
                onChange={(e) => updateRole(idx, e.target.value)}
                className="flex-1 text-sm border border-transparent rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-300 focus:bg-white hover:border-gray-200 transition-colors"
              />

              <button
                onClick={() => removeRole(idx)}
                className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Rolü sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Yeni rol ekle */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex gap-2">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="Yeni rol adı..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
            <button
              onClick={addRole}
              disabled={!newRole.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              Ekle
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Enter tuşu veya "Ekle" butonu ile listeye ekleyin. Kaydetmeden değişiklikler uygulanmaz.
          </p>
        </div>
      </div>

      {/* Gelecekte buraya proje ile ilgili diğer bakım ayarları taşınacak */}
      <div className="text-xs text-gray-400 text-center py-2">
        Diğer proje bakım ayarları buraya taşınacak.
      </div>
    </div>
  );
}
