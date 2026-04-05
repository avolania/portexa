"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, UserCog, Tag, Clock, Building2, GitMerge,
  Plus, Trash2, Pencil, X, ArrowUp, ArrowDown, ChevronRight,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { useITSMConfigStore } from "@/store/useITSMConfigStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ITSMRole, ChangeType } from "@/lib/itsm/types/enums";
import { Priority } from "@/lib/itsm/types/enums";
import {
  ITSM_ROLE_META, GROUP_TYPE_META,
} from "@/lib/itsm/types/config.types";
import type {
  ITSMConfigGroup, ITSMGroupType,
  ApprovalWorkflowTemplate, ApprovalWorkflowStep,
  ApproverStepType, ApprovalStepMode,
  CRApprovalWorkflows, SRApprovalConfig,
} from "@/lib/itsm/types/config.types";
import type { SLAPolicyEntry, BusinessHoursConfig } from "@/lib/itsm/types/interfaces";
import { cn } from "@/lib/utils";

// ─── Shared save helpers ──────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'ok' | 'error';

function useSave(fn: () => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const run = useCallback(async () => {
    setStatus('saving');
    setErrorMsg('');
    try {
      await fn();
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Bilinmeyen hata');
      setStatus('error');
    }
  }, [fn]);

  return { status, errorMsg, run };
}

function SaveButton({ status, errorMsg, onClick }: { status: SaveStatus; errorMsg: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 justify-end">
      {status === 'ok' && (
        <span className="flex items-center gap-1 text-sm text-emerald-600">
          <CheckCircle2 className="w-4 h-4" /> Kaydedildi
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {errorMsg.includes('does not exist') || errorMsg.includes('relation')
            ? 'Tablo bulunamadı — Supabase\'de SQL migration\'ı çalıştırın'
            : errorMsg}
        </span>
      )}
      <button onClick={onClick} disabled={status === 'saving'} className="btn-primary">
        {status === 'saving' ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "groups" | "users" | "categories" | "sla" | "hours" | "approval";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "groups",     label: "Ekipler",       icon: Users      },
  { id: "users",      label: "Kullanıcılar",   icon: UserCog    },
  { id: "categories", label: "Kategoriler",    icon: Tag        },
  { id: "sla",        label: "SLA",           icon: Clock      },
  { id: "hours",      label: "İş Saatleri",   icon: Building2  },
  { id: "approval",   label: "Onay Akışları",  icon: GitMerge   },
];

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 0];

// ─── Groups Tab ───────────────────────────────────────────────────────────────

function GroupsTab() {
  const { config, saveGroups } = useITSMConfigStore();
  const { profiles } = useAuthStore();
  const [groups, setGroups] = useState<ITSMConfigGroup[]>(config.groups);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; type: ITSMGroupType; memberIds: string[] }>({
    name: "", description: "", type: "all", memberIds: [],
  });

  useEffect(() => { setGroups(config.groups); }, [config.groups]);

  const resetForm = () => {
    setForm({ name: "", description: "", type: "all", memberIds: [] });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (g: ITSMConfigGroup) => {
    setForm({ name: g.name, description: g.description ?? "", type: g.type, memberIds: g.memberIds });
    setEditId(g.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    let updated: ITSMConfigGroup[];
    if (editId) {
      updated = groups.map((g) => g.id === editId ? { ...g, ...form } : g);
    } else {
      const newGroup: ITSMConfigGroup = {
        id: crypto.randomUUID(),
        ...form,
        createdAt: new Date().toISOString(),
      };
      updated = [...groups, newGroup];
    }
    await saveGroups(updated);
    setGroups(updated);
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const updated = groups.filter((g) => g.id !== id);
    await saveGroups(updated);
    setGroups(updated);
  };

  const toggleMember = (uid: string) => {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(uid) ? f.memberIds.filter((m) => m !== uid) : [...f.memberIds, uid],
    }));
  };

  const profileList = Object.values(profiles);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Incident, SR ve CR için destek ekipleri tanımlayın.</p>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Ekip Ekle
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">{editId ? "Ekibi Düzenle" : "Yeni Ekip"}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ekip Adı *</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ekip adı" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tip</label>
              <select className="input w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ITSMGroupType }))}>
                {Object.entries(GROUP_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Açıklama</label>
            <input className="input w-full" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="İsteğe bağlı" />
          </div>
          {profileList.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Üyeler</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {profileList.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.memberIds.includes(u.id)}
                      onChange={() => toggleMember(u.id)}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-sm text-gray-700 truncate">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="btn-secondary">İptal</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">Henüz ekip tanımlanmamış.</div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{g.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{GROUP_TYPE_META[g.type].label}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{g.memberIds.length} üye</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(g)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { config, saveUserRoles } = useITSMConfigStore();
  const { profiles } = useAuthStore();
  const [roles, setRoles] = useState<Record<string, ITSMRole>>(config.userRoles);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { setRoles(config.userRoles); }, [config.userRoles]);

  const handleRoleChange = async (userId: string, role: ITSMRole | "") => {
    setSaving(userId);
    const updated = { ...roles };
    if (role === "") {
      delete updated[userId];
    } else {
      updated[userId] = role;
    }
    await saveUserRoles(updated);
    setRoles(updated);
    setSaving(null);
  };

  const profileList = Object.values(profiles);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Kullanıcılara ITSM rolü atayın. Rol atanmayan kullanıcılar Son Kullanıcı olarak kabul edilir.</p>
      {profileList.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">Kullanıcı bulunamadı.</div>
      ) : (
        <div className="space-y-2">
          {profileList.map((u) => {
            const role = roles[u.id];
            const meta = role ? ITSM_ROLE_META[role] : null;
            return (
              <div key={u.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {meta && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", meta.color, meta.bg)}>
                      {meta.label}
                    </span>
                  )}
                  <select
                    className="input text-sm py-1 pr-7"
                    value={role ?? ""}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as ITSMRole | "")}
                    disabled={saving === u.id}
                  >
                    <option value="">— Rol Seç —</option>
                    {Object.values(ITSMRole).map((r) => (
                      <option key={r} value={r}>{ITSM_ROLE_META[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

type CatField = "incidentCategories" | "serviceRequestTypes" | "changeRequestCategories";
type CatKey = "incident" | "sr" | "cr";

function CategorySection({
  title, field, inputKey, items, inputValue,
  onInputChange, onAdd, onRemove,
}: {
  title: string;
  field: CatField;
  inputKey: CatKey;
  items: string[];
  inputValue: string;
  onInputChange: (key: CatKey, val: string) => void;
  onAdd: (field: CatField, key: CatKey) => void;
  onRemove: (field: CatField, item: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
            {item}
            <button onClick={() => onRemove(field, item)} className="text-gray-400 hover:text-red-500 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Yeni kategori ekle..."
          value={inputValue}
          onChange={(e) => onInputChange(inputKey, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd(field, inputKey))}
        />
        <button onClick={() => onAdd(field, inputKey)} className="btn-secondary px-3">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const { config, saveCategories } = useITSMConfigStore();
  const [cats, setCats] = useState(config.categories);
  const [inputs, setInputs] = useState<Record<CatKey, string>>({ incident: "", sr: "", cr: "" });

  useEffect(() => { setCats(config.categories); }, [config.categories]);

  const handleInputChange = (key: CatKey, val: string) => {
    setInputs((i) => ({ ...i, [key]: val }));
  };

  const handleAdd = (field: CatField, key: CatKey) => {
    const val = inputs[key].trim();
    if (!val || cats[field].includes(val)) return;
    setCats((c) => ({ ...c, [field]: [...c[field], val] }));
    setInputs((i) => ({ ...i, [key]: "" }));
  };

  const handleRemove = (field: CatField, item: string) => {
    setCats((c) => ({ ...c, [field]: c[field].filter((x) => x !== item) }));
  };

  const saveFn = useCallback(() => saveCategories(cats), [cats, saveCategories]);
  const { status, errorMsg, run } = useSave(saveFn);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Ticket kategorilerini ve türlerini yönetin.</p>
      <CategorySection
        title="Incident Kategorileri" field="incidentCategories" inputKey="incident"
        items={cats.incidentCategories} inputValue={inputs.incident}
        onInputChange={handleInputChange} onAdd={handleAdd} onRemove={handleRemove}
      />
      <CategorySection
        title="Servis Talebi Türleri" field="serviceRequestTypes" inputKey="sr"
        items={cats.serviceRequestTypes} inputValue={inputs.sr}
        onInputChange={handleInputChange} onAdd={handleAdd} onRemove={handleRemove}
      />
      <CategorySection
        title="Değişiklik Talebi Kategorileri" field="changeRequestCategories" inputKey="cr"
        items={cats.changeRequestCategories} inputValue={inputs.cr}
        onInputChange={handleInputChange} onAdd={handleAdd} onRemove={handleRemove}
      />
      <SaveButton status={status} errorMsg={errorMsg} onClick={run} />
    </div>
  );
}

// ─── SLA Tab ──────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.CRITICAL]: "Kritik",
  [Priority.HIGH]:     "Yüksek",
  [Priority.MEDIUM]:   "Orta",
  [Priority.LOW]:      "Düşük",
};

function SLATab() {
  const { config, saveIncidentSLA, saveSRSLA } = useITSMConfigStore();
  const [incPolicies, setIncPolicies] = useState(config.incidentSLAPolicies);
  const [srPolicies, setSrPolicies] = useState(config.srSLAPolicies);

  useEffect(() => {
    setIncPolicies(config.incidentSLAPolicies);
    setSrPolicies(config.srSLAPolicies);
  }, [config.incidentSLAPolicies, config.srSLAPolicies]);

  const saveFn = useCallback(async () => {
    await saveIncidentSLA(incPolicies);
    await saveSRSLA(srPolicies);
  }, [incPolicies, srPolicies, saveIncidentSLA, saveSRSLA]);
  const { status, errorMsg, run } = useSave(saveFn);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">Her öncelik seviyesi için yanıt ve çözüm sürelerini dakika cinsinden girin.</p>

      {/* Incident SLA */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Incident SLA</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {incPolicies.map((p, i) => (
            <div key={p.priority} className="px-4 py-3 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-20">{PRIORITY_LABELS[p.priority]}</span>
              <label className="text-xs text-gray-500">Yanıt (dk)</label>
              <input
                type="number" min={1} className="input w-24 text-sm"
                value={p.responseMinutes}
                onChange={(e) => setIncPolicies((pp) => pp.map((x, j) => j === i ? { ...x, responseMinutes: Number(e.target.value) } : x))}
              />
              <label className="text-xs text-gray-500">Çözüm (dk)</label>
              <input
                type="number" min={1} className="input w-24 text-sm"
                value={p.resolutionMinutes}
                onChange={(e) => setIncPolicies((pp) => pp.map((x, j) => j === i ? { ...x, resolutionMinutes: Number(e.target.value) } : x))}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
                <input
                  type="checkbox" checked={p.useBusinessHours}
                  onChange={(e) => setIncPolicies((pp) => pp.map((x, j) => j === i ? { ...x, useBusinessHours: e.target.checked } : x))}
                  className="rounded border-gray-300 text-indigo-600"
                />
                İş saatlerinde
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* SR SLA */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Servis Talebi SLA</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {srPolicies.map((p, i) => (
            <div key={p.priority} className="px-4 py-3 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-20">{PRIORITY_LABELS[p.priority]}</span>
              <label className="text-xs text-gray-500">Karşılama (dk)</label>
              <input
                type="number" min={1} className="input w-28 text-sm"
                value={p.fulfillmentMinutes}
                onChange={(e) => setSrPolicies((pp) => pp.map((x, j) => j === i ? { ...x, fulfillmentMinutes: Number(e.target.value) } : x))}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
                <input
                  type="checkbox" checked={p.useBusinessHours}
                  onChange={(e) => setSrPolicies((pp) => pp.map((x, j) => j === i ? { ...x, useBusinessHours: e.target.checked } : x))}
                  className="rounded border-gray-300 text-indigo-600"
                />
                İş saatlerinde
              </label>
            </div>
          ))}
        </div>
      </div>

      <SaveButton status={status} errorMsg={errorMsg} onClick={run} />
    </div>
  );
}

// ─── Business Hours Tab ───────────────────────────────────────────────────────

function BusinessHoursTab() {
  const { config, saveBusinessHours } = useITSMConfigStore();
  const [hours, setHours] = useState<BusinessHoursConfig>(config.businessHours);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => { setHours(config.businessHours); }, [config.businessHours]);

  const toggleDay = (day: number) => {
    setHours((h) => ({
      ...h,
      workDays: h.workDays.includes(day) ? h.workDays.filter((d) => d !== day) : [...h.workDays, day].sort((a, b) => a - b),
    }));
  };

  const addHoliday = () => {
    const val = newHoliday.trim();
    if (!val || hours.holidays.includes(val)) return;
    setHours((h) => ({ ...h, holidays: [...h.holidays, val].sort() }));
    setNewHoliday("");
  };

  const removeHoliday = (d: string) => {
    setHours((h) => ({ ...h, holidays: h.holidays.filter((x) => x !== d) }));
  };

  const saveFn = useCallback(() => saveBusinessHours(hours), [hours, saveBusinessHours]);
  const { status, errorMsg, run } = useSave(saveFn);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">SLA hesaplamaları için iş saati tanımını yapılandırın.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        {/* Timezone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Saat Dilimi</label>
            <input
              className="input w-full"
              value={hours.timezone}
              onChange={(e) => setHours((h) => ({ ...h, timezone: e.target.value }))}
            />
          </div>
        </div>

        {/* Work days */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Çalışma Günleri</label>
          <div className="flex gap-2">
            {WEEKDAY_NUMS.map((day, i) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                  hours.workDays.includes(day)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {WEEKDAYS[i]}
              </button>
            ))}
          </div>
        </div>

        {/* Hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Başlangıç Saati</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={23} className="input w-20 text-sm"
                value={hours.startHour}
                onChange={(e) => setHours((h) => ({ ...h, startHour: Number(e.target.value) }))}
              />
              <span className="text-gray-400">:</span>
              <input
                type="number" min={0} max={59} step={15} className="input w-20 text-sm"
                value={hours.startMinute}
                onChange={(e) => setHours((h) => ({ ...h, startMinute: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bitiş Saati</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={23} className="input w-20 text-sm"
                value={hours.endHour}
                onChange={(e) => setHours((h) => ({ ...h, endHour: Number(e.target.value) }))}
              />
              <span className="text-gray-400">:</span>
              <input
                type="number" min={0} max={59} step={15} className="input w-20 text-sm"
                value={hours.endMinute}
                onChange={(e) => setHours((h) => ({ ...h, endMinute: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        {/* Holidays */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Resmi Tatiller (YYYY-MM-DD)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {hours.holidays.map((d) => (
              <span key={d} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                {d}
                <button onClick={() => removeHoliday(d)} className="text-gray-400 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="2026-01-01"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHoliday())}
            />
            <button onClick={addHoliday} className="btn-secondary px-3">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <SaveButton status={status} errorMsg={errorMsg} onClick={run} />
    </div>
  );
}

// ─── Approval Tab ─────────────────────────────────────────────────────────────

const APPROVER_TYPE_LABELS: Record<ApproverStepType, string> = {
  user:  'Kullanıcı',
  role:  'ITSM Rolü',
  group: 'Ekip',
};

const APPROVAL_MODE_LABELS: Record<ApprovalStepMode, string> = {
  any: 'Herhangi biri',
  all: 'Tamamı',
};

const CR_TYPE_LABELS: Record<ChangeType, string> = {
  [ChangeType.STANDARD]:  'Standart Değişiklik',
  [ChangeType.NORMAL]:    'Normal Değişiklik',
  [ChangeType.EMERGENCY]: 'Acil Değişiklik',
};

function emptyStep(order: number): ApprovalWorkflowStep {
  return {
    id: crypto.randomUUID(),
    order,
    label: '',
    approverType: 'role',
    itsmRole: ITSMRole.CHANGE_MANAGER,
    approvalMode: 'any',
  };
}

function StepEditor({
  step,
  profiles,
  groups,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  step: ApprovalWorkflowStep;
  profiles: ReturnType<typeof useAuthStore.getState>['profiles'];
  groups: ITSMConfigGroup[];
  onChange: (s: ApprovalWorkflowStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const set = (patch: Partial<ApprovalWorkflowStep>) => onChange({ ...step, ...patch });

  return (
    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-gray-200">
      {/* order handle */}
      <div className="flex flex-col gap-0.5 pt-1">
        <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30">
          <ArrowUp className="w-3 h-3 text-gray-500" />
        </button>
        <span className="text-xs text-gray-400 text-center w-4">{step.order}</span>
        <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30">
          <ArrowDown className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      {/* fields */}
      <div className="flex-1 grid grid-cols-12 gap-2">
        {/* label */}
        <div className="col-span-4">
          <input
            className="input w-full text-sm"
            placeholder="Adım adı (ör. Birim Müdürü)"
            value={step.label}
            onChange={(e) => set({ label: e.target.value })}
          />
        </div>

        {/* type */}
        <div className="col-span-3">
          <select
            className="input w-full text-sm"
            value={step.approverType}
            onChange={(e) => {
              const t = e.target.value as ApproverStepType;
              set({
                approverType: t,
                userId: undefined, itsmRole: undefined, groupId: undefined,
                ...(t === 'role'  ? { itsmRole: ITSMRole.CHANGE_MANAGER } : {}),
                ...(t === 'group' ? { groupId: groups[0]?.id ?? '' } : {}),
                ...(t === 'user'  ? { userId: Object.keys(profiles)[0] ?? '' } : {}),
              });
            }}
          >
            {(Object.keys(APPROVER_TYPE_LABELS) as ApproverStepType[]).map((k) => (
              <option key={k} value={k}>{APPROVER_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {/* approver selector */}
        <div className="col-span-4">
          {step.approverType === 'role' && (
            <select
              className="input w-full text-sm"
              value={step.itsmRole ?? ''}
              onChange={(e) => set({ itsmRole: e.target.value as ITSMRole })}
            >
              {Object.values(ITSMRole).map((r) => (
                <option key={r} value={r}>{ITSM_ROLE_META[r].label}</option>
              ))}
            </select>
          )}
          {step.approverType === 'user' && (
            <select
              className="input w-full text-sm"
              value={step.fixedUserId ?? step.userId ?? ''}
              onChange={(e) => set({ userId: e.target.value, fixedUserId: e.target.value })}
            >
              <option value="">— Seçin —</option>
              {Object.values(profiles).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          {step.approverType === 'group' && (
            <select
              className="input w-full text-sm"
              value={step.groupId ?? ''}
              onChange={(e) => set({ groupId: e.target.value })}
            >
              <option value="">— Seçin —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* fixed user override (for role/group steps) */}
        {(step.approverType === 'group' || step.approverType === 'role') && (
          <div className="col-span-12 grid grid-cols-2 gap-3 mt-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sabit Kullanıcı (öncelikli, opsiyonel)</label>
              <select
                className="input w-full text-sm"
                value={step.fixedUserId ?? ''}
                onChange={(e) => set({ fixedUserId: e.target.value || undefined })}
              >
                <option value="">— Rol/Gruba göre çöz —</option>
                {Object.values(profiles).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Onay şartı</label>
              <div className="flex items-center gap-3 mt-2">
                {(['any', 'all'] as ApprovalStepMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio" name={`mode-${step.id}`} value={m}
                      checked={step.approvalMode === m}
                      onChange={() => set({ approvalMode: m })}
                      className="text-indigo-600"
                    />
                    <span className="text-xs text-gray-700">{APPROVAL_MODE_LABELS[m]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 mt-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TemplateEditor({
  template,
  profiles,
  groups,
  onSave,
  onCancel,
}: {
  template: Partial<ApprovalWorkflowTemplate> & { steps: ApprovalWorkflowStep[] };
  profiles: ReturnType<typeof useAuthStore.getState>['profiles'];
  groups: ITSMConfigGroup[];
  onSave: (t: ApprovalWorkflowTemplate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template.name ?? '');
  const [description, setDescription] = useState(template.description ?? '');
  const [steps, setSteps] = useState<ApprovalWorkflowStep[]>(template.steps);

  const addStep = () => {
    setSteps((ss) => [...ss, emptyStep(ss.length + 1)]);
  };

  const updateStep = (idx: number, s: ApprovalWorkflowStep) => {
    setSteps((ss) => ss.map((x, i) => (i === idx ? s : x)));
  };

  const deleteStep = (idx: number) => {
    setSteps((ss) => ss.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= steps.length) return;
    setSteps((ss) => {
      const arr = [...ss];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: template.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      steps,
      createdAt: template.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Akış Adı *</label>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Normal CR Onay Akışı" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Açıklama</label>
          <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı" />
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Onay Adımları (sıralı)</label>
          <button onClick={addStep} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            <Plus className="w-3.5 h-3.5" /> Adım Ekle
          </button>
        </div>
        {steps.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
            Henüz adım yok. "Adım Ekle" ile başlayın.
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((s, i) => (
              <StepEditor
                key={s.id}
                step={s}
                profiles={profiles}
                groups={groups}
                onChange={(updated) => updateStep(i, updated)}
                onDelete={() => deleteStep(i)}
                onMoveUp={() => moveStep(i, -1)}
                onMoveDown={() => moveStep(i, 1)}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary">İptal</button>
        <button onClick={handleSave} disabled={!name.trim()} className="btn-primary">Kaydet</button>
      </div>
    </div>
  );
}

function ApprovalTab() {
  const { config, saveApprovalWorkflows, saveCRApprovalWorkflows, saveSRApprovalConfig } = useITSMConfigStore();
  const { profiles } = useAuthStore();

  const [workflows, setWorkflows] = useState<ApprovalWorkflowTemplate[]>(config.approvalWorkflows ?? []);
  const [crWorkflows, setCRWorkflows] = useState<CRApprovalWorkflows>(
    config.crApprovalWorkflows ?? { [ChangeType.STANDARD]: null, [ChangeType.NORMAL]: null, [ChangeType.EMERGENCY]: null }
  );
  const [srConfig, setSRConfig] = useState<SRApprovalConfig>(
    config.srApprovalConfig ?? { requireApproval: false, workflowId: null }
  );
  const [editingTemplate, setEditingTemplate] = useState<(Partial<ApprovalWorkflowTemplate> & { steps: ApprovalWorkflowStep[] }) | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWorkflows(config.approvalWorkflows ?? []);
    setCRWorkflows(config.crApprovalWorkflows ?? { [ChangeType.STANDARD]: null, [ChangeType.NORMAL]: null, [ChangeType.EMERGENCY]: null });
    setSRConfig(config.srApprovalConfig ?? { requireApproval: false, workflowId: null });
  }, [config.approvalWorkflows, config.crApprovalWorkflows, config.srApprovalConfig]);

  const groups = config.groups;

  const handleSaveTemplate = async (t: ApprovalWorkflowTemplate) => {
    const updated = editingTemplate?.id
      ? workflows.map((w) => (w.id === t.id ? t : w))
      : [...workflows, t];
    setSaving(true);
    await saveApprovalWorkflows(updated);
    setWorkflows(updated);
    setEditingTemplate(null);
    setSaving(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    const updated = workflows.filter((w) => w.id !== id);
    // clear assignments that reference this template
    const newCR = Object.fromEntries(
      Object.entries(crWorkflows).map(([k, v]) => [k, v === id ? null : v])
    ) as CRApprovalWorkflows;
    const newSR = srConfig.workflowId === id ? { ...srConfig, workflowId: null } : srConfig;
    setSaving(true);
    await saveApprovalWorkflows(updated);
    await saveCRApprovalWorkflows(newCR);
    await saveSRApprovalConfig(newSR);
    setWorkflows(updated);
    setCRWorkflows(newCR);
    setSRConfig(newSR);
    setSaving(false);
  };

  const assignFn = useCallback(async () => {
    await saveCRApprovalWorkflows(crWorkflows);
    await saveSRApprovalConfig(srConfig);
  }, [crWorkflows, srConfig, saveCRApprovalWorkflows, saveSRApprovalConfig]);
  const { status: assignStatus, errorMsg: assignError, run: runAssign } = useSave(assignFn);

  const WorkflowSelect = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => (
    <select
      className="input text-sm py-1.5"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">— Onay Akışı Yok (otomatik geç) —</option>
      {workflows.map((w) => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Servis talepleri ve değişiklik talepleri için adım adım onay akışları tanımlayın. CR'larda iş birimi onaylarını ayrı adımlar olarak ekleyebilirsiniz.
      </p>

      {/* ── Workflow Templates ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Onay Akışı Şablonları</h3>
          {!editingTemplate && (
            <button
              onClick={() => setEditingTemplate({ steps: [] })}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> Yeni Şablon
            </button>
          )}
        </div>

        {editingTemplate && (
          <TemplateEditor
            template={editingTemplate}
            profiles={profiles}
            groups={groups}
            onSave={handleSaveTemplate}
            onCancel={() => setEditingTemplate(null)}
          />
        )}

        {workflows.length === 0 && !editingTemplate ? (
          <div className="text-center py-10 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
            Henüz onay akışı şablonu oluşturulmadı.
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.map((w) => (
              <div key={w.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{w.name}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {w.description && <span className="text-xs text-gray-500">{w.description}</span>}
                      <span className="text-xs text-gray-400">{w.steps.length} adım</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingTemplate({ ...w })}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(w.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Step summary */}
                {w.steps.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {w.steps.map((s, i) => (
                      <span key={s.id} className="flex items-center gap-1">
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                          {s.label || `Adım ${s.order}`}
                        </span>
                        {i < w.steps.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-gray-300" />
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CR Assignment ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Değişiklik Talebi Onay Atamaları</h3>
          <p className="text-xs text-gray-500 mt-0.5">Her CR tipine hangi onay akışının uygulanacağını seçin.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {(Object.values(ChangeType) as ChangeType[]).map((type) => (
            <div key={type} className="px-4 py-3 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-44">{CR_TYPE_LABELS[type]}</span>
              <div className="flex-1">
                <WorkflowSelect
                  value={crWorkflows[type]}
                  onChange={(v) => setCRWorkflows((c) => ({ ...c, [type]: v }))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SR Assignment ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Servis Talebi Onay Ayarları</h3>
        </div>
        <div className="px-4 py-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setSRConfig((c) => ({ ...c, requireApproval: !c.requireApproval }))}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors cursor-pointer",
                srConfig.requireApproval ? "bg-indigo-600" : "bg-gray-200"
              )}
            >
              <span className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                srConfig.requireApproval ? "translate-x-5" : "translate-x-0"
              )} />
            </div>
            <span className="text-sm text-gray-700">Tüm servis taleplerinde onay zorunlu</span>
          </label>
          {srConfig.requireApproval && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Onay Akışı</label>
              <WorkflowSelect
                value={srConfig.workflowId}
                onChange={(v) => setSRConfig((c) => ({ ...c, workflowId: v }))}
              />
            </div>
          )}
        </div>
      </div>

      <SaveButton status={assignStatus} errorMsg={assignError} onClick={runAssign} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ITSMSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("groups");
  const { load, loading } = useITSMConfigStore();
  const { loadProfiles } = useAuthStore();

  useEffect(() => {
    load();
    loadProfiles();
  }, [load, loadProfiles]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ITSM Ayarları</h1>
        <p className="text-sm text-gray-500 mt-1">Ekipler, kullanıcı rolleri, kategoriler, SLA, iş saatleri ve onay akışlarını yapılandırın.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Yükleniyor...</div>
      ) : (
        <>
          {activeTab === "groups"     && <GroupsTab />}
          {activeTab === "users"      && <UsersTab />}
          {activeTab === "categories" && <CategoriesTab />}
          {activeTab === "sla"        && <SLATab />}
          {activeTab === "hours"      && <BusinessHoursTab />}
          {activeTab === "approval"   && <ApprovalTab />}
        </>
      )}
    </div>
  );
}
