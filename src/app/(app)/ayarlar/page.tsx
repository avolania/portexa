"use client";

import { useState, useEffect } from "react";
import {
  Building2, Globe, Clock, Plug, Save, Check,
  Link2, Key, ChevronRight,
} from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { OrgSettings } from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

const TABS = ["Genel", "Çalışma Saatleri", "Entegrasyonlar"] as const;
type Tab = typeof TABS[number];

const TIMEZONES = [
  "Europe/Istanbul", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Tokyo", "Asia/Singapore",
];

const CURRENCIES = [
  { code: "TRY", label: "₺ Türk Lirası" },
  { code: "USD", label: "$ Dolar" },
  { code: "EUR", label: "€ Euro" },
  { code: "GBP", label: "£ Sterlin" },
];

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

const MONTHS = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
];

const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

// ─── Section helpers ──────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-indigo-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="sm:w-64 flex-shrink-0">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none rotate-90" />
    </div>
  );
}

// ─── Tab: Genel ──────────────────────────────────────────────────────────────

function GenelTab({ form, setForm }: { form: OrgSettings; setForm: (f: OrgSettings) => void }) {
  const set = (patch: Partial<OrgSettings>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <SectionTitle icon={Building2} title="Organizasyon" desc="Temel organizasyon bilgileri" />
        <Field label="Organizasyon Adı" desc="Uygulama genelinde görünen isim">
          <TextInput value={form.orgName} onChange={(v) => set({ orgName: v })} placeholder="Pixanto" />
        </Field>
        <Field label="Para Birimi" desc="Bütçe ve maliyet raporlarında kullanılır">
          <SelectInput
            value={form.currency}
            onChange={(v) => set({ currency: v })}
            options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
          />
        </Field>
        <Field label="Mali Yıl Başlangıcı" desc="Bütçe dönemleri bu aya göre hesaplanır">
          <SelectInput
            value={String(form.fiscalYearStart)}
            onChange={(v) => set({ fiscalYearStart: Number(v) })}
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
        </Field>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <SectionTitle icon={Globe} title="Dil & Bölge" desc="Saat dilimi ve tarih formatı tercihleri" />
        <Field label="Saat Dilimi">
          <SelectInput
            value={form.timezone}
            onChange={(v) => set({ timezone: v })}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
          />
        </Field>
        <Field label="Tarih Formatı">
          <div className="flex flex-wrap gap-2">
            {DATE_FORMATS.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => set({ dateFormat: fmt })}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  form.dateFormat === fmt
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

// ─── Tab: Çalışma Saatleri ───────────────────────────────────────────────────

function CalismaTab({ form, setForm }: { form: OrgSettings; setForm: (f: OrgSettings) => void }) {
  const set = (patch: Partial<OrgSettings>) => setForm({ ...form, ...patch });

  const toggleDay = (day: number) => {
    const days = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day].sort((a, b) => a - b);
    set({ workingDays: days });
  };

  const weekly = form.workingDays.length * form.workingHoursPerDay;
  const monthly = (weekly * 52) / 12;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <SectionTitle icon={Clock} title="Çalışma Saatleri" desc="Haftalık çalışma düzeninizi tanımlayın" />

      <Field label="Çalışma Günleri" desc="Varsayılan iş günlerini seçin">
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((day, i) => {
            const active = form.workingDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`w-10 h-10 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Günlük Çalışma Saati" desc="Bir iş gününün kaç saat olduğu">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={12}
            step={0.5}
            value={form.workingHoursPerDay}
            onChange={(e) => set({ workingHoursPerDay: Number(e.target.value) })}
            className="flex-1 accent-indigo-600"
          />
          <span className="text-sm font-semibold text-indigo-600 w-16 text-right">
            {form.workingHoursPerDay} saat
          </span>
        </div>
      </Field>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mt-2 pt-4 border-t border-gray-100">
        {[
          { label: "Haftalık", value: `${weekly.toFixed(1)} saat` },
          { label: "Çalışma Günü", value: `${form.workingDays.length} gün/hafta` },
          { label: "Aylık Ort.", value: `${monthly.toFixed(0)} saat` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-base font-bold text-indigo-700">{value.split(" ")[0]}</p>
            <p className="text-xs text-indigo-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Entegrasyonlar ──────────────────────────────────────────────────────

function IntegrationCard({
  icon: Icon, iconColor, title, desc, children, connected,
}: {
  icon: React.ElementType; iconColor: string; title: string; desc: string;
  children?: React.ReactNode; connected?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 truncate">{desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {connected ? (
            <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">Bağlı</span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Bağlı değil</span>
          )}
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>
      {expanded && children && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function EntegrasyonlarTab({ form, setForm }: { form: OrgSettings; setForm: (f: OrgSettings) => void }) {
  const setInt = (patch: Partial<OrgSettings["integrations"]>) =>
    setForm({ ...form, integrations: { ...form.integrations, ...patch } });

  return (
    <div className="space-y-3">
      <IntegrationCard
        icon={Plug}
        iconColor="bg-purple-50 text-purple-600"
        title="Slack"
        desc="Görev ve proje bildirimlerini Slack kanalına gönder"
        connected={!!form.integrations.slackWebhook}
      >
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Webhook URL</label>
          <input
            type="url"
            value={form.integrations.slackWebhook ?? ""}
            onChange={(e) => setInt({ slackWebhook: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </IntegrationCard>

      <IntegrationCard
        icon={Link2}
        iconColor="bg-blue-50 text-blue-600"
        title="Jira"
        desc="Jira görev ve epiklerini senkronize et"
        connected={!!(form.integrations.jiraUrl && form.integrations.jiraToken)}
      >
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Jira URL</label>
            <input
              type="url"
              value={form.integrations.jiraUrl ?? ""}
              onChange={(e) => setInt({ jiraUrl: e.target.value })}
              placeholder="https://yourorg.atlassian.net"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">API Token</label>
            <input
              type="password"
              value={form.integrations.jiraToken ?? ""}
              onChange={(e) => setInt({ jiraToken: e.target.value })}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>
      </IntegrationCard>

      <IntegrationCard
        icon={Key}
        iconColor="bg-amber-50 text-amber-600"
        title="Google Workspace"
        desc="Google Calendar ve Drive entegrasyonu"
        connected={!!form.integrations.googleClientId}
      >
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Client ID</label>
          <input
            type="text"
            value={form.integrations.googleClientId ?? ""}
            onChange={(e) => setInt({ googleClientId: e.target.value })}
            placeholder="xxxx.apps.googleusercontent.com"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </IntegrationCard>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AyarlarPage() {
  const { settings, update, loaded } = useSettingsStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("Genel");
  const [form, setForm] = useState<OrgSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded) setForm(settings);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = JSON.stringify(form) !== JSON.stringify(settings);
  const isAdmin = user?.role === "admin";

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>
        <p className="text-sm text-gray-500 mt-1">Organizasyon ve platform tercihlerinizi yönetin.</p>
      </div>

      {!isAdmin && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Bu sayfayı yalnızca Yöneticiler düzenleyebilir. Görüntüleme modundasınız.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <fieldset disabled={!isAdmin} className="disabled:opacity-60 disabled:pointer-events-none">
        {activeTab === "Genel" && <GenelTab form={form} setForm={setForm} />}
        {activeTab === "Çalışma Saatleri" && <CalismaTab form={form} setForm={setForm} />}
        {activeTab === "Entegrasyonlar" && <EntegrasyonlarTab form={form} setForm={setForm} />}
      </fieldset>

      {/* Floating save bar */}
      {isDirty && isAdmin && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm hidden sm:inline">Kaydedilmemiş değişiklikler</span>
          <button onClick={() => setForm(settings)} className="text-sm text-gray-400 hover:text-white transition-colors">
            Geri al
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Kaydediliyor..." : saved ? "Kaydedildi" : "Kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
