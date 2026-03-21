"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, Mail, User, Briefcase, Building2, Globe, Shield, Save, Phone } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ProfilPage() {
  const { user, updateUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initialForm = useCallback(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    title: user?.title ?? "",
    department: user?.department ?? "",
    company: user?.company ?? "",
    phone: user?.phone ?? "",
    language: user?.language ?? "tr",
  }), [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState(initialForm);
  const [isDirty, setIsDirty] = useState(false);

  // Rehydration'dan sonra formu senkronize et
  useEffect(() => {
    const fresh = initialForm();
    setForm(fresh);
    setIsDirty(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field: string, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    // Mevcut user ile karşılaştır
    const orig = initialForm();
    setIsDirty(JSON.stringify(updated) !== JSON.stringify(orig));
  };

  // Şifre formu
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const handlePasswordUpdate = async () => {
    setPwError("");
    if (!pwForm.current) { setPwError("Mevcut şifreyi girin."); return; }
    if (pwForm.newPw.length < 8) { setPwError("Yeni şifre en az 8 karakter olmalıdır."); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError("Yeni şifreler eşleşmiyor."); return; }
    if (pwForm.current === pwForm.newPw) { setPwError("Yeni şifre mevcut şifreden farklı olmalıdır."); return; }
    setPwSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setPwSaving(false);
    setPwForm({ current: "", newPw: "", confirm: "" });
    setPwSuccess(true);
    setTimeout(() => setPwSuccess(false), 3000);
  };

  const [notifications, setNotifications] = useState({
    taskAssigned: true,
    taskUpdated: false,
    comments: true,
    deadlines: true,
    budgetAlerts: true,
    emailDigest: false,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    updateUser({
      name: form.name,
      title: form.title,
      department: form.department,
      company: form.company,
      phone: form.phone,
      language: form.language as "tr" | "en",
    });
    setSaving(false);
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const tabs = ["Kişisel Bilgiler", "Bildirimler", "Güvenlik"] as const;
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Kişisel Bilgiler");

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900">Profil</h1>

      {/* Avatar section */}
      <div className="card flex items-center gap-5">
        <div className="relative">
          <Avatar name={user?.name ?? "U"} size="lg" className="w-20 h-20 text-2xl" />
          <button className="absolute bottom-0 right-0 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors">
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{user?.name}</div>
          <div className="text-sm text-gray-500">{user?.email}</div>
          {user?.company && <div className="text-sm text-gray-400 mt-0.5">{user.company}</div>}
          <div className="mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user?.role === "admin" ? "bg-indigo-100 text-indigo-700" :
              user?.role === "pm" ? "bg-cyan-100 text-cyan-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {user?.role === "admin" ? "Yönetici" : user?.role === "pm" ? "Proje Müdürü" : "Üye"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Kişisel Bilgiler */}
      {activeTab === "Kişisel Bilgiler" && (
        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                id="name"
                label="Ad Soyad"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                icon={<User className="w-4 h-4" />}
              />
            </div>
            <div className="col-span-2">
              <Input
                id="email"
                label="E-posta"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                icon={<Mail className="w-4 h-4" />}
              />
            </div>
            <div className="col-span-2">
              <Input
                id="company"
                label="Şirket / Organizasyon"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                icon={<Building2 className="w-4 h-4" />}
                placeholder="Şirket Adı"
              />
            </div>
            <Input
              id="title"
              label="Unvan"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              icon={<Briefcase className="w-4 h-4" />}
              placeholder="Proje Müdürü"
            />
            <Input
              id="department"
              label="Departman"
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              icon={<Building2 className="w-4 h-4" />}
              placeholder="Yazılım"
            />
            <div className="col-span-2">
              <Input
                id="phone"
                label="Telefon"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                icon={<Phone className="w-4 h-4" />}
                placeholder="+90 555 000 00 00"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-gray-400" />
              Dil Tercihi
            </label>
            <div className="flex gap-3">
              {(["tr", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleChange("language", lang)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.language === lang
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {lang === "tr" ? "🇹🇷 Türkçe" : "🇬🇧 English"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Bildirimler */}
      {activeTab === "Bildirimler" && (
        <div className="card space-y-1 divide-y divide-gray-100">
          {([
            { key: "taskAssigned", label: "Görev Atanması", desc: "Size yeni bir görev atandığında" },
            { key: "taskUpdated", label: "Görev Güncellemeleri", desc: "Atandığınız görevler güncellendiğinde" },
            { key: "comments", label: "Yorumlar ve @mention", desc: "Yorum yapıldığında veya etiketlendiğinizde" },
            { key: "deadlines", label: "Deadline Uyarıları", desc: "Son tarih yaklaşınca (1 ve 3 gün önce)" },
            { key: "budgetAlerts", label: "Bütçe Uyarıları", desc: "Proje bütçesi %75 veya %90 aşıldığında" },
            { key: "emailDigest", label: "E-posta Özeti", desc: "Günlük özet e-postası al" },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3 first:pt-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => setNotifications((n) => ({ ...n, [key]: !n[key] }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  notifications[key] ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                  style={{ transform: notifications[key] ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Güvenlik */}
      {activeTab === "Güvenlik" && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              Şifre Değiştir
            </h3>
            <Input
              id="current-pw"
              label="Mevcut Şifre"
              type="password"
              placeholder="••••••••"
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
            />
            <Input
              id="new-pw"
              label="Yeni Şifre"
              type="password"
              placeholder="En az 8 karakter"
              value={pwForm.newPw}
              onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
            />
            <Input
              id="confirm-pw"
              label="Yeni Şifre (Tekrar)"
              type="password"
              placeholder="••••••••"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
            />
            {pwError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                ✓ Şifre başarıyla güncellendi.
              </p>
            )}
            <Button size="sm" onClick={handlePasswordUpdate} loading={pwSaving}>
              Şifreyi Güncelle
            </Button>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">İki Faktörlü Doğrulama</h3>
            <p className="text-xs text-gray-500 mb-4">Hesabınıza ekstra bir güvenlik katmanı ekleyin.</p>
            <Button variant="secondary" size="sm">2FA Aktifleştir</Button>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Oturum Geçmişi</h3>
            <div className="space-y-2 mt-3">
              {[
                { device: "Chrome — macOS", location: "İstanbul, TR", time: "Şu an aktif" },
                { device: "Safari — iPhone", location: "İstanbul, TR", time: "2 saat önce" },
              ].map((s) => (
                <div key={s.device} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{s.device}</div>
                    <div className="text-xs text-gray-500">{s.location} · {s.time}</div>
                  </div>
                  {s.time !== "Şu an aktif" && (
                    <button className="text-xs text-red-500 hover:underline">Oturumu Kapat</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating save bar — sadece değişiklik varsa göster */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm">Kaydedilmemiş değişiklikler var</span>
          <button
            onClick={() => { setForm(initialForm()); setIsDirty(false); }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Geri al
          </button>
          <Button size="sm" onClick={handleSave} loading={saving} className="bg-white text-gray-900 hover:bg-gray-100">
            <Save className="w-4 h-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          {saved && <span className="text-sm text-emerald-400">✓ Kaydedildi</span>}
        </div>
      )}
    </div>
  );
}
