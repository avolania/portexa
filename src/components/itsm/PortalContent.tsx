"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Monitor, Code2, Wifi, Lock, HelpCircle,
  Users, User, Package, Key, UserCog, MoreHorizontal,
  ChevronRight, ChevronLeft, CheckCircle2,
  Clock, Zap, AlertCircle, Flame, Search,
  LifeBuoy, ArrowLeft,
  ShieldAlert, Database, Settings2, Share2, BarChart2,
  GitPullRequest, Terminal,
  Paperclip, X as XIcon,
  Laptop, Printer, Smartphone, Download, ShieldCheck, Mail, UserPlus, Wrench,
  Building2,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Impact, Urgency, SapModule, SapCategory, IncidentState, ServiceRequestState } from "@/lib/itsm/types/enums";
import { cn } from "@/lib/utils";

// ─── Service Catalog ──────────────────────────────────────────────────────────

interface ServiceItem {
  id: string;
  cat: string;
  name: string;
  icon: React.ElementType;
  sla: string;
  approvalRequired: boolean;
  popular?: boolean;
}

const SERVICE_ITEMS: ServiceItem[] = [
  { id: "hw-laptop",     cat: "hardware",   name: "Laptop / Bilgisayar Talebi",   icon: Laptop,       sla: "5 iş günü", approvalRequired: true,  popular: true  },
  { id: "hw-monitor",    cat: "hardware",   name: "Monitör Talebi",               icon: Monitor,      sla: "3 iş günü", approvalRequired: false               },
  { id: "hw-peripheral", cat: "hardware",   name: "Çevre Birimi (Mouse, Klavye)", icon: Wrench,       sla: "3 iş günü", approvalRequired: false               },
  { id: "hw-phone",      cat: "hardware",   name: "Telefon / Mobil Cihaz",        icon: Smartphone,   sla: "5 iş günü", approvalRequired: true                },
  { id: "sw-license",    cat: "software",   name: "Yazılım Lisansı Talebi",       icon: Package,      sla: "3 iş günü", approvalRequired: true,  popular: true  },
  { id: "sw-install",    cat: "software",   name: "Yazılım Kurulumu",             icon: Download,     sla: "1 iş günü", approvalRequired: false               },
  { id: "acc-vpn",       cat: "access",     name: "VPN Erişim Talebi",            icon: ShieldCheck,  sla: "1 iş günü", approvalRequired: true,  popular: true  },
  { id: "acc-email",     cat: "access",     name: "E-posta Hesabı",               icon: Mail,         sla: "1 iş günü", approvalRequired: false               },
  { id: "acc-sap",       cat: "access",     name: "SAP Yetki Talebi",             icon: Key,          sla: "3 iş günü", approvalRequired: true                },
  { id: "acc-share",     cat: "access",     name: "Dosya Paylaşım Yetkisi",       icon: Share2,       sla: "1 iş günü", approvalRequired: false               },
  { id: "on-new",        cat: "onboarding", name: "Yeni Çalışan IT Kurulumu",     icon: UserPlus,     sla: "5 iş günü", approvalRequired: true                },
  { id: "on-off",        cat: "onboarding", name: "Çalışan Ayrılış İşlemi",      icon: UserCog,      sla: "2 iş günü", approvalRequired: true                },
  { id: "other-move",    cat: "other",      name: "Ofis / Masa Taşıma",           icon: Building2,    sla: "5 iş günü", approvalRequired: false               },
  { id: "other-print",   cat: "other",      name: "Yazıcı Erişimi",               icon: Printer,      sla: "1 iş günü", approvalRequired: false               },
];

const SERVICE_CATS = [
  { id: "all",        label: "Tümü"           },
  { id: "hardware",   label: "Donanım"        },
  { id: "software",   label: "Yazılım"        },
  { id: "access",     label: "Erişim & Yetki" },
  { id: "onboarding", label: "Onboarding"     },
  { id: "other",      label: "Diğer"          },
];

// ─── Incident step data ────────────────────────────────────────────────────────

const INCIDENT_CATS = [
  { id: "infra",    icon: Database,    label: "Altyapı & Sunucu",   desc: "Sunucu, disk, performans"         },
  { id: "network",  icon: Wifi,        label: "Ağ & Bağlantı",     desc: "İnternet, VPN, Wi-Fi"             },
  { id: "sap",      icon: Settings2,   label: "SAP",                desc: "SAP modül hataları, yetki, veri" },
  { id: "app",      icon: Code2,       label: "Diğer Uygulamalar",  desc: "Office 365, Teams, CRM, tarayıcı" },
  { id: "hardware", icon: Monitor,     label: "Donanım",            desc: "Laptop, yazıcı, monitör"         },
  { id: "security", icon: ShieldAlert, label: "Güvenlik",           desc: "Virüs, şüpheli e-posta"          },
  { id: "email",    icon: Mail,        label: "E-posta",            desc: "Gönderilemiyor, spam"            },
];

const INC_URGENCY_OPTS = [
  { id: "critical", label: "Kritik",  desc: "İş tamamen durdu, birçok kişi etkileniyor", urgency: Urgency.HIGH,   color: "border-red-300    bg-red-50"    },
  { id: "high",     label: "Yüksek", desc: "İş ciddi şekilde etkileniyor, geçici çözüm yok", urgency: Urgency.HIGH, color: "border-orange-300 bg-orange-50" },
  { id: "medium",   label: "Orta",   desc: "İş kısmen etkileniyor, geçici çözüm mevcut", urgency: Urgency.MEDIUM, color: "border-amber-300  bg-amber-50"  },
  { id: "low",      label: "Düşük",  desc: "Küçük bir sorun, acil değil",              urgency: Urgency.LOW,    color: "border-green-300  bg-green-50"  },
];

// ─── SAP support (preserved) ───────────────────────────────────────────────────

const SAP_MODULES = Object.values(SapModule);

const SAP_CATEGORY_OPTIONS = [
  { id: SapCategory.SYSTEM_ERROR,    icon: ShieldAlert,    label: "Sistem Hatası",     color: "text-red-600    bg-red-50"     },
  { id: SapCategory.AUTHORIZATION,   icon: Lock,           label: "Yetki / Erişim",   color: "text-orange-600 bg-orange-50"  },
  { id: SapCategory.PERFORMANCE,     icon: Zap,            label: "Performans",        color: "text-amber-600  bg-amber-50"   },
  { id: SapCategory.DATA,            icon: Database,       label: "Veri",              color: "text-blue-600   bg-blue-50"    },
  { id: SapCategory.CONFIGURATION,   icon: Settings2,      label: "Konfigürasyon",     color: "text-purple-600 bg-purple-50"  },
  { id: SapCategory.INTEGRATION,     icon: Share2,         label: "Entegrasyon",       color: "text-indigo-600 bg-indigo-50"  },
  { id: SapCategory.REPORTING,       icon: BarChart2,      label: "Raporlama",         color: "text-emerald-600 bg-emerald-50"},
  { id: SapCategory.CHANGE_REQUEST,  icon: GitPullRequest, label: "Değişiklik Talebi", color: "text-teal-600   bg-teal-50"    },
  { id: SapCategory.NEW_DEVELOPMENT, icon: Terminal,       label: "Yeni Geliştirme",   color: "text-sky-600    bg-sky-50"     },
  { id: SapCategory.OTHER,           icon: HelpCircle,     label: "Diğer",             color: "text-gray-500   bg-gray-100"   },
];

function isSapCategory(cat: string) {
  return cat === "sap";
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function FileUpload({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-200 text-sm">
              <span className="flex-1 truncate text-gray-700">{f.name}</span>
              <span className="text-xs text-gray-400 shrink-0 font-mono">
                {f.size < 1024 ? `${f.size} B` : f.size < 1_048_576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1_048_576).toFixed(1)} MB`}
              </span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 shrink-0">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="relative flex items-center gap-2 px-3 py-2.5 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors cursor-pointer overflow-hidden">
        <Paperclip className="w-4 h-4" />
        Dosya ekle
        <span className="text-xs text-gray-400">(ekran görüntüsü, log, vb.)</span>
        <input
          type="file" multiple
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          onChange={(e) => { if (e.target.files) onChange([...files, ...Array.from(e.target.files)]); e.target.value = ""; }}
        />
      </label>
    </div>
  );
}

// ─── Incident Form (3-step wizard) ────────────────────────────────────────────

interface IncFormState {
  title: string;
  description: string;
  category: string;
  sapCategory: string;
  sapModule: string;
  urgency: string;
  affectedUsers: string;
  location: string;
  contactMethod: string;
  files: File[];
}

function IncidentForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: (num: string, urgencyLabel: string) => void }) {
  const { create, addAttachment } = useIncidentStore();
  const { user } = useAuthStore();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const pendingFilesRef = useRef<File[]>([]);

  const [form, setForm] = useState<IncFormState>({
    title: "", description: "", category: "", sapCategory: "", sapModule: "",
    urgency: "", affectedUsers: "just-me", location: "", contactMethod: "email", files: [],
  });

  const update = (k: keyof IncFormState, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const STEPS = ["Sorun Tanımı", "Sınıflandırma", "Ek Bilgiler"];
  const canNext0 = form.title.trim().length >= 3;
  const canNext1 = !!form.category && !!form.urgency;
  const urgencyOpt = INC_URGENCY_OPTS.find(u => u.id === form.urgency);

  const handleSubmit = async () => {
    if (!user || !urgencyOpt) return;
    setSaving(true);
    setSaveError("");
    try {
      const impactMap: Record<string, Impact> = {
        "just-me": Impact.LOW, team: Impact.MEDIUM, department: Impact.HIGH, company: Impact.HIGH,
      };
      const incident = await create({
        callerId: user.id,
        reportedById: user.id,
        category: form.category,
        sapCategory: form.sapCategory || undefined,
        sapModule: form.sapModule || undefined,
        impact: impactMap[form.affectedUsers] ?? Impact.LOW,
        urgency: urgencyOpt.urgency,
        shortDescription: form.title,
        description: [
          form.description,
          form.location ? `Konum: ${form.location}` : "",
          `Tercih edilen iletişim: ${form.contactMethod}`,
        ].filter(Boolean).join("\n\n"),
      });
      const files = pendingFilesRef.current.length > 0 ? pendingFilesRef.current : form.files;
      if (incident && files.length > 0) {
        for (const f of files) await addAttachment(incident.id, f);
      }
      if (incident) onSuccess(incident.number, urgencyOpt.label);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Back + stepper */}
        <div>
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                    step > i ? "bg-emerald-500 text-white" :
                    step === i ? "bg-indigo-600 text-white" :
                    "bg-gray-200 text-gray-500"
                  )}>{step > i ? "✓" : i + 1}</span>
                  <span className={cn("text-xs font-medium hidden sm:block", step === i ? "text-gray-900" : "text-gray-400")}>{s}</span>
                </div>
                {i < 2 && <div className={cn("flex-1 h-0.5 mx-2", step > i ? "bg-emerald-400" : "bg-gray-200")} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 0 — Describe */}
        {step === 0 && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Sorunu Tanımlayın</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ne olduğunu bize anlatın, en kısa sürede çözelim</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sorun nedir? <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                className="input w-full"
                placeholder="ör: E-posta gönderemiyorum, VPN bağlanamıyorum..."
                value={form.title}
                onChange={e => update("title", e.target.value)}
                maxLength={140}
              />
              <div className="text-xs text-gray-400 text-right mt-1">{form.title.length}/140</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Detaylı açıklama</label>
              <textarea
                className="input w-full min-h-[100px] resize-none"
                placeholder={"Sorunu detaylandırın:\n• Ne zaman başladı?\n• Hata mesajı var mı?\n• Daha önce çalışıyor muydu?"}
                value={form.description}
                onChange={e => update("description", e.target.value)}
              />
            </div>
            <FileUpload
              files={form.files}
              onChange={files => { pendingFilesRef.current = files; update("files", files); }}
            />
            <div className="flex justify-end">
              <button disabled={!canNext0} onClick={() => setStep(1)} className="btn-primary disabled:opacity-40 flex items-center gap-1.5">
                Devam <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Classify */}
        {step === 1 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Sınıflandırma</h2>
              <p className="text-xs text-gray-500 mt-0.5">Sorunu doğru ekibe yönlendirmemize yardımcı olun</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kategori <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INCIDENT_CATS.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button key={cat.id} type="button" onClick={() => update("category", cat.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-center transition-all",
                        form.category === cat.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300 bg-white"
                      )}>
                      <Icon className={cn("w-5 h-5", form.category === cat.id ? "text-indigo-600" : "text-gray-400")} />
                      <div className={cn("text-xs font-semibold leading-tight", form.category === cat.id ? "text-indigo-900" : "text-gray-700")}>{cat.label}</div>
                      <div className="text-[10px] text-gray-400 leading-tight">{cat.desc}</div>
                    </button>
                  );
                })}
              </div>

              {isSapCategory(form.category) && (
                <div className="mt-3 p-4 border border-indigo-100 bg-indigo-50/40 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">SAP Alt Kategorisi</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {SAP_CATEGORY_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const [textCls, bgCls] = opt.color.split(" ");
                      return (
                        <button key={opt.id} type="button" onClick={() => update("sapCategory", form.sapCategory === opt.id ? "" : opt.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-center transition-all",
                            form.sapCategory === opt.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"
                          )}>
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", form.sapCategory === opt.id ? "bg-indigo-100" : bgCls)}>
                            <Icon className={cn("w-4 h-4", form.sapCategory === opt.id ? "text-indigo-600" : textCls)} />
                          </div>
                          <span className="text-[10px] font-medium leading-tight text-gray-700">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">SAP Modülü <span className="text-gray-400 font-normal">(opsiyonel)</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {SAP_MODULES.map(m => (
                        <button key={m} type="button" onClick={() => update("sapModule", form.sapModule === m ? "" : m)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                            form.sapModule === m ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                          )}>{m}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ne kadar acil? <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {INC_URGENCY_OPTS.map(opt => (
                  <button key={opt.id} type="button" onClick={() => update("urgency", opt.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
                      form.urgency === opt.id ? cn(opt.color, "border-2") : "border-gray-200 bg-white hover:border-gray-300"
                    )}>
                    <div className={cn("text-sm font-semibold min-w-[52px]", form.urgency === opt.id ? "text-gray-900" : "text-gray-700")}>{opt.label}</div>
                    <div className="text-xs text-gray-500 flex-1">{opt.desc}</div>
                    {form.urgency === opt.id && <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Geri
              </button>
              <button disabled={!canNext1} onClick={() => setStep(2)} className="btn-primary disabled:opacity-40 flex items-center gap-1.5">
                Devam <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Additional info */}
        {step === 2 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Ek Bilgiler</h2>
              <p className="text-xs text-gray-500 mt-0.5">Çözüm sürecini hızlandıracak ek bilgiler</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Kaç kişi etkileniyor?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "just-me",    label: "Sadece Ben"     },
                  { id: "team",       label: "Ekibim (~5-10)" },
                  { id: "department", label: "Tüm Departman"  },
                  { id: "company",    label: "Tüm Şirket"     },
                ].map(opt => (
                  <button key={opt.id} type="button" onClick={() => update("affectedUsers", opt.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                      form.affectedUsers === opt.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    )}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Konum / Kat</label>
                <input
                  className="input w-full"
                  placeholder="ör: A Blok 3. Kat"
                  value={form.location}
                  onChange={e => update("location", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tercih Edilen İletişim</label>
                <div className="flex gap-2">
                  {[
                    { id: "email", label: "E-posta" },
                    { id: "phone", label: "Telefon" },
                    { id: "teams", label: "Teams"   },
                  ].map(c => (
                    <button key={c.id} type="button" onClick={() => update("contactMethod", c.id)}
                      className={cn(
                        "flex-1 py-2 px-2 rounded-lg border-2 text-xs font-medium transition-all",
                        form.contactMethod === c.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"
                      )}>{c.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                ⚠️ {saveError}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Geri
              </button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary disabled:opacity-40 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {saving ? "Kaydediliyor..." : "Olay Bildir"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar summary */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="card sticky top-20 space-y-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bildirim Özeti</p>
          {[
            { label: "Sorun",     val: form.title || "—" },
            { label: "Kategori", val: INCIDENT_CATS.find(c => c.id === form.category)?.label || "—" },
            { label: "Aciliyet", val: INC_URGENCY_OPTS.find(u => u.id === form.urgency)?.label || "—" },
            { label: "Etkilenen", val: ({ "just-me": "Sadece Ben", team: "Ekip", department: "Departman", company: "Şirket" } as Record<string, string>)[form.affectedUsers] || "—" },
            { label: "Ekler",    val: form.files.length > 0 ? `${form.files.length} dosya` : "—" },
          ].map((item, i) => (
            <div key={i}>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{item.label}</div>
              <div className={cn("text-xs font-medium mt-0.5 break-words", item.val === "—" ? "text-gray-300" : "text-gray-800")}>{item.val}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 mb-1">💡 İpucu</p>
          <p className="text-xs text-amber-600 leading-relaxed">
            {step === 0 && "Ekran görüntüsü eklemeniz çözüm süresini önemli ölçüde kısaltır."}
            {step === 1 && "Doğru kategori seçimi talebinizin doğru ekibe atanmasını sağlar."}
            {step === 2 && "Etkilenen kullanıcı sayısı olay önceliğinin belirlenmesinde kullanılır."}
          </p>
        </div>
      </aside>
    </div>
  );
}

// ─── Service Catalog ───────────────────────────────────────────────────────────

function ServiceCatalog({ onSelect }: { onSelect: (item: ServiceItem) => void }) {
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = SERVICE_ITEMS
    .filter(s => catFilter === "all" || s.cat === catFilter)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Hizmet Kataloğu</h2>
        <p className="text-sm text-gray-500 mt-0.5">İhtiyacınız olan hizmeti seçin ve talep formunu doldurun</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input w-full pl-9"
          placeholder="Hizmet ara... (laptop, VPN, lisans, yetki...)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {SERVICE_CATS.map(cat => (
          <button key={cat.id} type="button" onClick={() => setCatFilter(cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-semibold transition-all",
              catFilter === cat.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            )}>{cat.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => onSelect(item)}
              className="group flex flex-col items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 hover:border-indigo-400 hover:shadow-sm transition-all text-left">
              <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                <Icon className="w-5 h-5 text-gray-500 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">SLA: {item.sla}</span>
                  {item.approvalRequired && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Onay Gerekli</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 text-sm">Aradığınız hizmet bulunamadı</div>
        )}
      </div>
    </div>
  );
}

// ─── Service Request Form ──────────────────────────────────────────────────────

interface SvcFormState {
  requestFor: "myself" | "someone";
  requestForName: string;
  justification: string;
  urgency: "low" | "medium" | "high";
  additionalNotes: string;
  files: File[];
}

function ServiceRequestForm({ item, onBack, onSuccess }: {
  item: ServiceItem;
  onBack: () => void;
  onSuccess: (num: string) => void;
}) {
  const { create, addAttachment } = useServiceRequestStore();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState<SvcFormState>({
    requestFor: "myself", requestForName: "", justification: "",
    urgency: "medium", additionalNotes: "", files: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SvcFormState, string>>>({});

  const update = (k: keyof SvcFormState, v: unknown) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Partial<Record<keyof SvcFormState, string>> = {};
    if (form.requestFor === "someone" && !form.requestForName.trim()) e.requestForName = "Kişi adı gerekli";
    if (!form.justification.trim()) e.justification = "Talep gerekçesi yazın";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      const urgencyMap = { low: Urgency.LOW, medium: Urgency.MEDIUM, high: Urgency.HIGH };
      const sr = await create({
        requestedForId: user.id,
        requestedById: user.id,
        requestType: item.cat,
        category: item.cat,
        impact: Impact.LOW,
        urgency: urgencyMap[form.urgency],
        shortDescription: item.name,
        description: [
          form.justification,
          form.requestFor === "someone" && form.requestForName ? `Talep edilen kişi: ${form.requestForName}` : "",
          form.additionalNotes || "",
        ].filter(Boolean).join("\n\n"),
        justification: form.justification,
        approvalRequired: item.approvalRequired,
      });
      if (sr && form.files.length > 0) {
        for (const f of form.files) await addAttachment(sr.id, f);
      }
      if (sr) onSuccess(sr.number);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const ItemIcon = item.icon;

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-5">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Kataloğa Dön
        </button>

        {/* Item header */}
        <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-indigo-100">
          <div className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <ItemIcon className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-gray-200 rounded-md text-indigo-700 font-mono">SLA: {item.sla}</span>
              {item.approvalRequired && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-amber-700">Yönetici Onayı Gerekli</span>
              )}
            </div>
          </div>
        </div>

        <div className="card space-y-5">
          <h3 className="text-sm font-bold text-gray-900">Talep Detayları</h3>

          {/* Request for */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bu talep kimin için?</label>
            <div className="flex gap-3">
              {[
                { id: "myself",  label: "Kendim için"       },
                { id: "someone", label: "Başka biri için"   },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => update("requestFor", opt.id as SvcFormState["requestFor"])}
                  className={cn(
                    "flex-1 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all",
                    form.requestFor === opt.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"
                  )}>{opt.label}</button>
              ))}
            </div>
            {form.requestFor === "someone" && (
              <div className="mt-2">
                <input className="input w-full" placeholder="Kişinin adı soyadı..."
                  value={form.requestForName} onChange={e => update("requestForName", e.target.value)} />
                {errors.requestForName && <p className="text-xs text-red-500 mt-1">{errors.requestForName}</p>}
              </div>
            )}
          </div>

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Talep gerekçesi <span className="text-red-500">*</span>
            </label>
            <textarea
              className={cn("input w-full min-h-[90px] resize-none", errors.justification && "border-red-300")}
              placeholder={"Bu hizmete neden ihtiyacınız var?\n\nörn: Yeni projeye başlıyorum ve Adobe Photoshop gerekiyor..."}
              value={form.justification}
              onChange={e => update("justification", e.target.value)}
            />
            {errors.justification && <p className="text-xs text-red-500 mt-1">{errors.justification}</p>}
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aciliyet</label>
            <div className="flex gap-2">
              {[
                { id: "low",    label: "Bekleyebilir", desc: "Planlı sürede"  },
                { id: "medium", label: "Normal",        desc: "SLA içinde"     },
                { id: "high",   label: "Acil",          desc: "Hızlandırılmış" },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => update("urgency", opt.id as SvcFormState["urgency"])}
                  className={cn(
                    "flex-1 py-2.5 px-2 rounded-xl border-2 text-center transition-all",
                    form.urgency === opt.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white"
                  )}>
                  <div className={cn("text-xs font-semibold", form.urgency === opt.id ? "text-indigo-700" : "text-gray-700")}>{opt.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ek notlar <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
            <textarea
              className="input w-full min-h-[70px] resize-none"
              placeholder="Özel tercihler, marka, model, konfigürasyon vb..."
              value={form.additionalNotes}
              onChange={e => update("additionalNotes", e.target.value)}
            />
          </div>

          {/* Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Dosya eki <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
            <FileUpload files={form.files} onChange={files => update("files", files)} />
          </div>

          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {saveError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button onClick={handleSubmit} disabled={saving} className="btn-primary disabled:opacity-40 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              {saving ? "Gönderiliyor..." : "Talep Oluştur"}
            </button>
          </div>
        </div>
      </div>

      {/* Process sidebar */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="card sticky top-20 space-y-1">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Talep Süreci</p>
          {[
            { label: "Talep Oluşturma",                                                     icon: Package,      active: true  },
            { label: item.approvalRequired ? "Yönetici Onayı" : "Otomatik Onay",            icon: item.approvalRequired ? Users : CheckCircle2, active: false },
            { label: "IT İşleme",                                                           icon: Wrench,       active: false },
            { label: "Teslim",                                                              icon: CheckCircle2, active: false },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className={cn("flex items-center gap-2.5 py-2", !s.active && "opacity-40")}>
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                  s.active ? "bg-indigo-100" : "bg-gray-100")}>
                  <Icon className={cn("w-3.5 h-3.5", s.active ? "text-indigo-600" : "text-gray-400")} />
                </div>
                <span className={cn("text-xs font-medium", s.active ? "text-gray-900" : "text-gray-500")}>{s.label}</span>
              </div>
            );
          })}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase">Tahmini Süre</div>
            <div className="text-base font-bold text-indigo-700 font-mono mt-0.5">{item.sla}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── Success screen ────────────────────────────────────────────────────────────

interface SuccessTicket {
  type: "incident" | "sr";
  number: string;
  title: string;
  urgencyLabel?: string;
  sla?: string;
  approvalRequired?: boolean;
}

function SuccessScreen({ ticket, onReset, myTicketsHref }: {
  ticket: SuccessTicket; onReset: () => void; myTicketsHref: string;
}) {
  const isInc = ticket.type === "incident";
  return (
    <div className="flex items-center justify-center py-10">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-4">
        <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl", isInc ? "bg-red-100" : "bg-blue-100")}>
          {isInc ? "⚠️" : "📋"}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isInc ? "Olay Bildiriminiz Alındı" : "Hizmet Talebiniz Oluşturuldu"}
          </h2>
          <div className={cn("text-2xl font-extrabold font-mono mt-2", isInc ? "text-red-600" : "text-blue-600")}>
            {ticket.number}
          </div>
          <p className="text-sm text-gray-500 mt-1">{ticket.title}</p>
        </div>
        {ticket.urgencyLabel && (
          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-red-50 text-red-700">
            {ticket.urgencyLabel} Aciliyet
          </span>
        )}
        {ticket.sla && (
          <p className="text-sm text-gray-500">
            Tahmini teslim süresi: <strong className="text-indigo-700">{ticket.sla}</strong>
          </p>
        )}
        {ticket.approvalRequired && (
          <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            ⏳ Yönetici onayı bekleniyor — onay sonrası işleme alınacaktır
          </div>
        )}
        <div className="p-4 bg-gray-50 rounded-xl text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Sonraki Adımlar</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            {isInc
              ? "Bildiriminiz ilgili ekibe iletildi. E-posta ile durum güncellemeleri alacaksınız."
              : "Talebiniz onay sürecine alındı. Her adımda e-posta ile bilgilendirileceksiniz."}
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-1">
          <button onClick={onReset} className="btn-secondary">Ana Sayfa</button>
          <Link href={myTicketsHref} className="btn-primary">Taleplerime Git</Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Page = "home" | "incident" | "service" | "service-form";

export default function PortalContent({
  myTicketsHref,
  itsmDashboardHref,
}: {
  myTicketsHref: string;
  itsmDashboardHref?: string;
}) {
  const [page, setPage] = useState<Page>("home");
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
  const [success, setSuccess] = useState<SuccessTicket | null>(null);

  const { incidents } = useIncidentStore();
  const { serviceRequests } = useServiceRequestStore();
  const { user } = useAuthStore();

  const myOpenIncidents = incidents.filter(i =>
    i.state !== IncidentState.CLOSED && i.state !== IncidentState.RESOLVED
  ).length;
  const mySRs = serviceRequests.filter(sr =>
    sr.state !== ServiceRequestState.CLOSED && sr.state !== ServiceRequestState.CANCELLED
  ).length;

  const resetAll = () => { setPage("home"); setSelectedItem(null); setSuccess(null); };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <SuccessScreen ticket={success} onReset={resetAll} myTicketsHref={myTicketsHref} />
      </div>
    );
  }

  // ── Home ───────────────────────────────────────────────────────────────────
  if (page === "home") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {itsmDashboardHref && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link href={itsmDashboardHref} className="hover:text-indigo-600">ITSM</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 font-medium">Destek Portalı</span>
          </div>
        )}

        {/* Hero */}
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <LifeBuoy className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nasıl yardımcı olabiliriz?</h1>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Bir sorun bildirin veya IT hizmeti talep edin. Talebiniz otomatik olarak ilgili ekibe yönlendirilecektir.
          </p>
        </div>

        {/* Two main cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setPage("incident")}
            className="group flex flex-col items-start gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/50 bg-white transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-base">Olay Bildirimi</div>
              <div className="text-sm text-gray-500 mt-1 leading-relaxed">Bir sorun veya kesinti bildirin</div>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-red-600">
              Sorun Bildir <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => setPage("service")}
            className="group flex flex-col items-start gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 bg-white transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 text-base">Hizmet Talebi</div>
              <div className="text-sm text-gray-500 mt-1 leading-relaxed">Yeni bir hizmet veya kaynak talep edin</div>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-blue-600">
              Talep Oluştur <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Popular services */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Popüler Hizmetler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SERVICE_ITEMS.filter(s => s.popular).map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button"
                  onClick={() => { setSelectedItem(item); setPage("service-form"); }}
                  className="group flex flex-col items-start gap-2 p-4 rounded-xl bg-white border border-gray-200 hover:border-indigo-400 hover:shadow-sm transition-all text-left">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                    <Icon className="w-4.5 h-4.5 text-gray-500 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">SLA: {item.sla}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* My tickets quick link */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
          <div>
            <div className="text-sm font-bold text-gray-800">Açık Taleplerim</div>
            <div className="text-xs text-gray-400 mt-0.5">Mevcut bildirim ve taleplerinizi takip edin</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {myOpenIncidents > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold font-mono">{myOpenIncidents} Incident</span>
            )}
            {mySRs > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold font-mono">{mySRs} SR</span>
            )}
            <Link href={myTicketsHref} className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-0.5">
              Görüntüle <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Incident ───────────────────────────────────────────────────────────────
  if (page === "incident") {
    return (
      <div className="max-w-4xl mx-auto">
        <IncidentForm
          onBack={() => setPage("home")}
          onSuccess={(num, urgencyLabel) => setSuccess({
            type: "incident", number: num, title: "Olay Bildirimi", urgencyLabel,
          })}
        />
      </div>
    );
  }

  // ── Service catalog ────────────────────────────────────────────────────────
  if (page === "service") {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button onClick={() => setPage("home")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Geri
        </button>
        <ServiceCatalog onSelect={item => { setSelectedItem(item); setPage("service-form"); }} />
      </div>
    );
  }

  // ── Service form ───────────────────────────────────────────────────────────
  if (page === "service-form" && selectedItem) {
    return (
      <div className="max-w-4xl mx-auto">
        <ServiceRequestForm
          item={selectedItem}
          onBack={() => setPage("service")}
          onSuccess={(num) => setSuccess({
            type: "sr", number: num, title: selectedItem.name,
            sla: selectedItem.sla, approvalRequired: selectedItem.approvalRequired,
          })}
        />
      </div>
    );
  }

  return null;
}
