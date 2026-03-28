"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Monitor, Code2, Wifi, Lock, HelpCircle,
  Users, User, Building2, Globe,
  Package, Key, UserCog, MoreHorizontal,
  ChevronRight, ChevronLeft, CheckCircle2,
  Clock, Zap, AlertCircle, Flame,
  LifeBuoy, ArrowLeft,
  ShieldAlert, Database, Settings2, Share2, BarChart2,
  GitPullRequest, Terminal, Wrench,
  Paperclip, X as XIcon,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Impact, Urgency, SapModule, SapCategory } from "@/lib/itsm/types/enums";
import { cn } from "@/lib/utils";

// ─── Sabit veriler ─────────────────────────────────────────────────────────────

const INCIDENT_CATEGORIES = [
  { id: "hardware",  icon: Monitor,       label: "Donanım",           desc: "Bilgisayar, ekran, yazıcı vb." },
  { id: "software",  icon: Code2,         label: "Yazılım",           desc: "Uygulama hatası, çökme, donma" },
  { id: "network",   icon: Wifi,          label: "Ağ / Bağlantı",    desc: "İnternet, VPN, ağ erişimi" },
  { id: "access",    icon: Lock,          label: "Erişim / Yetki",   desc: "Şifre, giriş, yetki sorunu" },
  { id: "other",     icon: HelpCircle,    label: "Diğer",             desc: "Yukarıdakilerden biri değil" },
];

const IMPACT_OPTIONS = [
  { value: Impact.LOW,    icon: User,      label: "Sadece ben",      desc: "Yalnızca beni etkiliyor",                  color: "border-blue-200 bg-blue-50 text-blue-700"   },
  { value: Impact.MEDIUM, icon: Users,     label: "Birkaç kişi",     desc: "Ekibimden birkaç kişiyi etkiliyor",        color: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: Impact.HIGH,   icon: Building2, label: "Departmanım",     desc: "Tüm departmanımı etkiliyor",              color: "border-orange-200 bg-orange-50 text-orange-700" },
  { value: Impact.HIGH,   icon: Globe,     label: "Tüm şirket",      desc: "Organizasyonun tamamını etkiliyor",        color: "border-red-200 bg-red-50 text-red-700"  },
];

const URGENCY_OPTIONS = [
  { value: Urgency.LOW,    icon: Clock,        label: "Düşük",    desc: "Uygun bir zamanda çözülebilir",      color: "border-gray-200 bg-gray-50 text-gray-700"    },
  { value: Urgency.MEDIUM, icon: Zap,          label: "Orta",     desc: "Bu hafta içinde çözülmeli",          color: "border-blue-200 bg-blue-50 text-blue-700"    },
  { value: Urgency.HIGH,   icon: AlertCircle,  label: "Yüksek",   desc: "Bugün veya yarın çözülmeli",         color: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: Urgency.HIGH,   icon: Flame,        label: "Kritik",   desc: "İş durdu, hemen müdahale gerekli",   color: "border-red-200 bg-red-50 text-red-700",  forceHigh: true },
];

const SAP_MODULES = Object.values(SapModule);

const SAP_CATEGORY_OPTIONS = [
  { id: SapCategory.SYSTEM_ERROR,    icon: ShieldAlert,     label: "Sistem Hatası",       color: "text-red-600    bg-red-50    group-hover:bg-red-100"    },
  { id: SapCategory.AUTHORIZATION,   icon: Lock,            label: "Yetki / Erişim",      color: "text-orange-600 bg-orange-50 group-hover:bg-orange-100" },
  { id: SapCategory.PERFORMANCE,     icon: Zap,             label: "Performans",          color: "text-amber-600  bg-amber-50  group-hover:bg-amber-100"  },
  { id: SapCategory.DATA,            icon: Database,        label: "Veri",                color: "text-blue-600   bg-blue-50   group-hover:bg-blue-100"   },
  { id: SapCategory.CONFIGURATION,   icon: Settings2,       label: "Konfigürasyon",       color: "text-purple-600 bg-purple-50 group-hover:bg-purple-100" },
  { id: SapCategory.INTEGRATION,     icon: Share2,          label: "Entegrasyon",         color: "text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100" },
  { id: SapCategory.REPORTING,       icon: BarChart2,       label: "Raporlama",           color: "text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100" },
  { id: SapCategory.CHANGE_REQUEST,  icon: GitPullRequest,  label: "Değişiklik Talebi",   color: "text-teal-600   bg-teal-50   group-hover:bg-teal-100"   },
  { id: SapCategory.NEW_DEVELOPMENT, icon: Terminal,        label: "Yeni Geliştirme",     color: "text-sky-600    bg-sky-50    group-hover:bg-sky-100"    },
  { id: SapCategory.OTHER,           icon: HelpCircle,      label: "Diğer",               color: "text-gray-500   bg-gray-100  group-hover:bg-gray-200"   },
];

const SR_TYPES = [
  { id: "software",  icon: Code2,      label: "Yazılım Erişimi",    desc: "Uygulama, lisans, sistem erişimi" },
  { id: "hardware",  icon: Package,    label: "Donanım Talebi",     desc: "Bilgisayar, ekipman, aksesuar" },
  { id: "access",    icon: Key,        label: "Erişim / Yetki",    desc: "Klasör, sistem, uygulama yetkisi" },
  { id: "account",   icon: UserCog,    label: "Hesap Yönetimi",     desc: "Yeni hesap, güncelleme, silme" },
  { id: "other",     icon: MoreHorizontal, label: "Diğer",          desc: "Başka bir hizmet talebi" },
];

// ─── Kart bileşeni ──────────────────────────────────────────────────────────────

function SelectCard({
  icon: Icon, label, desc, selected, onClick, color,
}: {
  icon: React.ElementType; label: string; desc: string;
  selected: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
        selected ? "bg-indigo-100" : "bg-gray-100"
      )}>
        <Icon className={cn("w-5 h-5", selected ? "text-indigo-600" : "text-gray-500")} />
      </div>
      <div className="min-w-0">
        <div className={cn("font-medium text-sm", selected ? "text-indigo-900" : "text-gray-900")}>{label}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</div>
      </div>
      {selected && <CheckCircle2 className="w-5 h-5 text-indigo-500 flex-shrink-0 ml-auto mt-0.5" />}
    </button>
  );
}

// ─── SAP Kategori kart (kompakt, 3 kolonlu grid için) ───────────────────────────

function SapCategoryCard({
  icon: Icon, label, color, selected, onClick,
}: {
  icon: React.ElementType; label: string; color: string;
  selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative group flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all",
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
        selected ? "bg-indigo-100" : color.split(" ").slice(1).join(" ")
      )}>
        <Icon className={cn("w-4 h-4", selected ? "text-indigo-600" : color.split(" ")[0])} />
      </div>
      <span className={cn("text-xs font-medium leading-tight", selected ? "text-indigo-900" : "text-gray-700")}>
        {label}
      </span>
      {selected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 absolute top-1.5 right-1.5" />}
    </button>
  );
}

// ─── SAP seçici blok (kategori kartları + modül chip'leri) ──────────────────────

function SapSelector({
  sapCategory, setSapCategory, sapModule, setSapModule,
}: {
  sapCategory: string; setSapCategory: (v: string) => void;
  sapModule: string; setSapModule: (v: string) => void;
}) {
  return (
    <div className="space-y-4 pt-1">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">SAP Kategorisi <span className="text-gray-400 font-normal">(opsiyonel)</span></p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {SAP_CATEGORY_OPTIONS.map((opt) => (
            <SapCategoryCard
              key={opt.id}
              icon={opt.icon}
              label={opt.label}
              color={opt.color}
              selected={sapCategory === opt.id}
              onClick={() => setSapCategory(sapCategory === opt.id ? "" : opt.id)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">SAP Modülü <span className="text-gray-400 font-normal">(opsiyonel)</span></p>
        <div className="flex flex-wrap gap-2">
          {SAP_MODULES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSapModule(sapModule === m ? "" : m)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all",
                sapModule === m
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Impact / Urgency kart ──────────────────────────────────────────────────────

function ImpactCard({
  icon: Icon, label, desc, selected, onClick, color,
}: {
  icon: React.ElementType; label: string; desc: string;
  selected: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
        selected ? cn("border-2", color) : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0", selected ? "" : "text-gray-400")} />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
      {selected && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
}

// ─── Başarı ekranı ──────────────────────────────────────────────────────────────

function SuccessScreen({ number, type, onReset, myTicketsHref }: {
  number: string; type: "incident" | "sr"; onReset: () => void; myTicketsHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {type === "incident" ? "Olay kaydedildi" : "Talep oluşturuldu"}
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          Kayıt numaranız: <span className="font-mono font-semibold text-gray-800">{number}</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Destek ekibi en kısa sürede sizinle iletişime geçecek.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onReset} className="btn-primary">Yeni Kayıt Oluştur</button>
        <Link href={myTicketsHref} className="btn-secondary">Kayıtları Görüntüle</Link>
      </div>
    </div>
  );
}

// ─── Bölüm başlığı ──────────────────────────────────────────────────────────────

function SectionLabel({ num, title, subtitle }: { num: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {num}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Incident Formu ─────────────────────────────────────────────────────────────

function IncidentForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: (num: string) => void }) {
  const { create, addAttachment } = useIncidentStore();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingFilesRef = useRef<File[]>([]);

  const [category, setCategory]       = useState("");
  const [sapCategory, setSapCategory] = useState("");
  const [sapModule, setSapModule]     = useState("");
  const [impactIdx, setImpactIdx]     = useState<number | null>(null);
  const [urgencyIdx, setUrgencyIdx]   = useState<number | null>(null);
  const [shortDesc, setShortDesc]     = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = !!category && impactIdx !== null && urgencyIdx !== null && shortDesc.trim().length >= 5;

  const handleSubmit = async () => {
    if (!user || !canSubmit || impactIdx === null || urgencyIdx === null) return;
    setSaving(true);
    const incident = await create({
      callerId:         user.id,
      reportedById:     user.id,
      category,
      sapCategory:      sapCategory || undefined,
      sapModule:        sapModule   || undefined,
      impact:           IMPACT_OPTIONS[impactIdx].value,
      urgency:          URGENCY_OPTIONS[urgencyIdx].value,
      shortDescription: shortDesc,
      description,
    });
    const filesToUpload = pendingFilesRef.current.length > 0 ? pendingFilesRef.current : pendingFiles;
    if (incident && filesToUpload.length > 0) {
      for (const file of filesToUpload) {
        await addAttachment(incident.id, file);
      }
    }
    setSaving(false);
    if (incident) onSuccess(incident.number);
  };

  return (
    <div className="space-y-0 divide-y divide-gray-100">
      {/* Başlık */}
      <div className="pb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Geri
        </button>
        <h2 className="text-lg font-bold text-gray-900">Olay Bildirimi</h2>
        <p className="text-sm text-gray-500 mt-0.5">Yaşadığınız sorunu aşağıdaki formu doldurarak bildirin</p>
      </div>

      {/* 1 — Kısa açıklama */}
      <div className="py-5 space-y-3">
        <SectionLabel num={1} title="Sorunu kısaca özetleyin" subtitle="Ne olduğunu tek cümleyle anlatın" />
        <input
          className="input w-full"
          placeholder="ör: SAP FI modülünde fatura girişi yapılamıyor, ağa bağlanamıyorum..."
          value={shortDesc}
          onChange={(e) => setShortDesc(e.target.value)}
          maxLength={140}
          autoFocus
        />
        <div className="text-xs text-gray-400 text-right">{shortDesc.length}/140</div>
      </div>

      {/* 2 — Kategori */}
      <div className="py-5 space-y-3">
        <SectionLabel num={2} title="Kategori" subtitle="En uygun olanı seçin" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {INCIDENT_CATEGORIES.map((c) => (
            <SelectCard
              key={c.id}
              icon={c.icon}
              label={c.label}
              desc={c.desc}
              selected={category === c.id}
              onClick={() => {
                setCategory(c.id);
                if (c.id !== "software") { setSapCategory(""); setSapModule(""); }
              }}
            />
          ))}
        </div>

        {category === "software" && (
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">SAP Alt Kategorisi</p>
            <SapSelector
              sapCategory={sapCategory} setSapCategory={setSapCategory}
              sapModule={sapModule}     setSapModule={setSapModule}
            />
          </div>
        )}
      </div>

      {/* 3 — Etki alanı */}
      <div className="py-5 space-y-3">
        <SectionLabel num={3} title="Bu sorun kaç kişiyi etkiliyor?" subtitle="Doğru önceliklendirme için etki alanını belirtin" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {IMPACT_OPTIONS.map((opt, i) => (
            <ImpactCard
              key={i}
              icon={opt.icon}
              label={opt.label}
              desc={opt.desc}
              color={opt.color}
              selected={impactIdx === i}
              onClick={() => setImpactIdx(i)}
            />
          ))}
        </div>
      </div>

      {/* 4 — Aciliyet */}
      <div className="py-5 space-y-3">
        <SectionLabel num={4} title="Ne kadar acil?" subtitle="İşinizi nasıl etkilediğini değerlendirin" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {URGENCY_OPTIONS.map((opt, i) => (
            <ImpactCard
              key={i}
              icon={opt.icon}
              label={opt.label}
              desc={opt.desc}
              color={opt.color}
              selected={urgencyIdx === i}
              onClick={() => setUrgencyIdx(i)}
            />
          ))}
        </div>
      </div>

      {/* 5 — Detaylı açıklama */}
      <div className="py-5 space-y-3">
        <SectionLabel num={5} title="Detaylı açıklama" subtitle="Opsiyonel — ne kadar çok bilgi o kadar hızlı çözüm" />
        <textarea
          className="input w-full min-h-[100px] resize-none"
          placeholder="Sorun nasıl oluştu? Hata mesajı var mı? Hangi adımları denediniz?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* 6 — Ekler */}
      <div className="py-5 space-y-3">
        <SectionLabel num={6} title="Ekler" subtitle="Opsiyonel — ekran görüntüsü veya ilgili dosyalar" />
        {pendingFiles.length > 0 && (
          <div className="space-y-1">
            {pendingFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-200 text-sm">
                <span className="flex-1 truncate text-gray-700">{file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                </span>
                <button type="button" onClick={() => setPendingFiles((pf) => pf.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 shrink-0">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="relative flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors cursor-pointer overflow-hidden">
          <Paperclip className="w-4 h-4" /> Dosya ekle
          <input
            type="file"
            multiple
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                pendingFilesRef.current = [...pendingFilesRef.current, ...files];
                setPendingFiles([...pendingFilesRef.current]);
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Submit */}
      <div className="pt-5 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {!category && "Kategori seçilmedi · "}
          {impactIdx === null && "Etki seçilmedi · "}
          {urgencyIdx === null && "Aciliyet seçilmedi · "}
          {shortDesc.trim().length < 5 && "Kısa açıklama gerekli"}
          {canSubmit && <span className="text-emerald-600 font-medium">Gönderilmeye hazır</span>}
        </p>
        <button
          disabled={!canSubmit || saving}
          onClick={handleSubmit}
          className="btn-primary disabled:opacity-40"
        >
          {saving ? "Kaydediliyor..." : "Olay Bildir"}
        </button>
      </div>
    </div>
  );
}

// ─── Service Request Formu ──────────────────────────────────────────────────────

function ServiceRequestForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: (num: string) => void }) {
  const { create, addAttachment } = useServiceRequestStore();
  const { user } = useAuthStore();
  const [step, setStep]                 = useState(1);
  const [saving, setSaving]             = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [requestType, setRequestType]   = useState("");
  const [sapCategory, setSapCategory]   = useState("");
  const [sapModule, setSapModule]       = useState("");
  const [shortDesc, setShortDesc]       = useState("");
  const [description, setDescription]   = useState("");
  const [justification, setJustification] = useState("");
  const [urgency, setUrgency]           = useState<Urgency>(Urgency.LOW);
  const [impact, setImpact]             = useState<Impact>(Impact.LOW);
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [forWhom, setForWhom]           = useState("");
  const [desiredDate, setDesiredDate]   = useState("");

  const canStep2 = !!requestType;
  const canSubmit = shortDesc.trim().length >= 5;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSaving(true);
    const desc = [
      description,
      forSomeoneElse && forWhom ? `Talep edilen kişi: ${forWhom}` : "",
      desiredDate ? `İstenen tamamlanma tarihi: ${desiredDate}` : "",
    ].filter(Boolean).join("\n\n");

    const sr = await create({
      requestedForId:   user.id,
      requestedById:    user.id,
      requestType,
      category:         requestType,
      sapCategory:      sapCategory || undefined,
      sapModule:        sapModule   || undefined,
      impact,
      urgency,
      shortDescription: shortDesc,
      description:      desc,
      justification:    justification || undefined,
      approvalRequired: false,
    });
    if (sr && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        await addAttachment(sr.id, file);
      }
    }
    setSaving(false);
    if (sr) onSuccess(sr.number);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>

      {/* Adım göstergesi */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
              step === s ? "bg-indigo-600 text-white" :
              step > s  ? "bg-emerald-500 text-white" :
              "bg-gray-200 text-gray-500"
            )}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            <span className={cn("text-xs font-medium", step === s ? "text-gray-900" : "text-gray-400")}>
              {["Talep Türü", "Detaylar"][s - 1]}
            </span>
            {s < 2 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ADIM 1 — Talep Türü */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ne tür bir talepte bulunmak istiyorsunuz?</h2>
            <p className="text-sm text-gray-500 mt-1">Talebinizle en ilgili kategoriyi seçin</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SR_TYPES.map((t) => (
              <SelectCard
                key={t.id}
                icon={t.icon}
                label={t.label}
                desc={t.desc}
                selected={requestType === t.id}
                onClick={() => {
                  setRequestType(t.id);
                  if (t.id !== "software") { setSapCategory(""); setSapModule(""); }
                }}
              />
            ))}
          </div>

          {requestType === "software" && (
            <div className="border border-indigo-100 bg-indigo-50/50 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-3">SAP Alt Kategorisi</p>
              <SapSelector
                sapCategory={sapCategory} setSapCategory={setSapCategory}
                sapModule={sapModule}     setSapModule={setSapModule}
              />
            </div>
          )}

          {/* Başkası için mi? */}
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setForSomeoneElse(!forSomeoneElse)}
                className={cn(
                  "w-10 h-6 rounded-full transition-colors flex items-center px-1",
                  forSomeoneElse ? "bg-indigo-600" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow transition-transform",
                  forSomeoneElse ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
              <span className="text-sm text-gray-700">Başkası adına talep açıyorum</span>
            </label>
            {forSomeoneElse && (
              <input
                className="input w-full mt-3"
                placeholder="Ad Soyad veya e-posta"
                value={forWhom}
                onChange={(e) => setForWhom(e.target.value)}
              />
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              disabled={!canStep2}
              onClick={() => setStep(2)}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              Devam <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ADIM 2 — Detaylar */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Talebinizi açıklayın</h2>
            <p className="text-sm text-gray-500 mt-1">Detaylı bilgi talebin daha hızlı işlenmesini sağlar</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Talebi kısaca özetleyin <span className="text-red-500">*</span>
            </label>
            <input
              className="input w-full"
              placeholder="ör: Adobe Acrobat lisansı gerekiyor, yeni çalışan için laptop talebi..."
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              maxLength={140}
            />
            <div className="text-xs text-gray-400 mt-1 text-right">{shortDesc.length}/140</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Detaylı açıklama</label>
            <textarea
              className="input w-full min-h-[90px] resize-none"
              placeholder="İhtiyacınızı, spesifikasyonları ve ek bilgileri buraya yazın..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gerekçe</label>
            <textarea
              className="input w-full min-h-[70px] resize-none"
              placeholder="Bu talep neden gerekli? İş süreçlerinizi nasıl etkiliyor?"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Aciliyet</label>
              <div className="space-y-2">
                {[
                  { value: Urgency.LOW,    label: "Standart",  desc: "1-2 hafta içinde" },
                  { value: Urgency.MEDIUM, label: "Öncelikli", desc: "2-3 iş günü içinde" },
                  { value: Urgency.HIGH,   label: "Acil",      desc: "Bugün / yarın" },
                ].map((opt) => (
                  <label key={opt.value} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    urgency === opt.value ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
                  )}>
                    <input
                      type="radio" name="urgency" className="sr-only"
                      checked={urgency === opt.value}
                      onChange={() => setUrgency(opt.value)}
                    />
                    <div className={cn(
                      "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0",
                      urgency === opt.value ? "border-indigo-500 bg-indigo-500" : "border-gray-300"
                    )} />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">İstenen Tamamlanma Tarihi</label>
              <input
                type="date"
                className="input w-full"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1.5">Belirli bir tarihiniz yoksa boş bırakın</p>
            </div>
          </div>

          {/* Ekler */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Ekler <span className="text-gray-400 font-normal">(opsiyonel)</span></p>
            {pendingFiles.length > 0 && (
              <div className="space-y-1">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-200 text-sm">
                    <span className="flex-1 truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button type="button" onClick={() => setPendingFiles((pf) => pf.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 shrink-0">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="relative flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors cursor-pointer overflow-hidden">
              <Paperclip className="w-4 h-4" /> Dosya ekle
              <input
                type="file"
                multiple
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                onChange={(e) => {
                  if (e.target.files) setPendingFiles((pf) => [...pf, ...Array.from(e.target.files!)]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Özet */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Talep türü: </span>
            {SR_TYPES.find((t) => t.id === requestType)?.label}
            {forSomeoneElse && forWhom && (
              <> · <span className="font-medium text-gray-700">Kişi: </span>{forWhom}</>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Geri
            </button>
            <button
              disabled={!canSubmit || saving}
              onClick={handleSubmit}
              className="btn-primary disabled:opacity-40"
            >
              {saving ? "Gönderiliyor..." : "Talebi Gönder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ana Sayfa ──────────────────────────────────────────────────────────────────

type Mode = null | "incident" | "sr";
type SuccessState = { number: string; type: "incident" | "sr" } | null;

export default function PortalContent({
  myTicketsHref,
  itsmDashboardHref,
}: {
  myTicketsHref: string;
  itsmDashboardHref?: string;
}) {
  const [mode, setMode]       = useState<Mode>(null);
  const [success, setSuccess] = useState<SuccessState>(null);

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <SuccessScreen
            number={success.number}
            type={success.type}
            myTicketsHref={myTicketsHref}
            onReset={() => { setMode(null); setSuccess(null); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        {itsmDashboardHref && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={itsmDashboardHref} className="hover:text-indigo-600">ITSM</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 font-medium">Self Service Portal</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Destek Portalı</h1>
            <p className="text-sm text-gray-500">Size nasıl yardımcı olabiliriz?</p>
          </div>
        </div>
      </div>

      <div className="card">
        {mode === null && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Lütfen talebinizin türünü seçin:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setMode("incident")}
                className="group flex flex-col items-start gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-base">Sorun Bildir</div>
                  <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Bir şeyler çalışmıyor mu? Teknik bir arıza veya erişim sorunu bildirin.
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-red-600 mt-auto">
                  Olay kaydı aç <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => setMode("sr")}
                className="group flex flex-col items-start gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                  <Package className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-base">Hizmet Talep Et</div>
                  <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Yeni bir yazılım, donanım, erişim veya hesap talebi oluşturun.
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-indigo-600 mt-auto">
                  Talep oluştur <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            {/* Alt bağlantılar */}
            <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-500">
              <Link href={myTicketsHref} className="hover:text-indigo-600">Taleplerim</Link>
              {itsmDashboardHref && (
                <Link href={itsmDashboardHref} className="hover:text-indigo-600">ITSM Dashboard</Link>
              )}
            </div>
          </div>
        )}

        {mode === "incident" && (
          <IncidentForm
            onBack={() => setMode(null)}
            onSuccess={(num) => setSuccess({ number: num, type: "incident" })}
          />
        )}

        {mode === "sr" && (
          <ServiceRequestForm
            onBack={() => setMode(null)}
            onSuccess={(num) => setSuccess({ number: num, type: "sr" })}
          />
        )}
      </div>
    </div>
  );
}
