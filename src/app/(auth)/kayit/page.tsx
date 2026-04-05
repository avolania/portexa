"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { User, Mail, Lock, Briefcase, LayoutGrid, Phone, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";

const schema = z.object({
  name: z.string().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  company: z.string().min(2, "Şirket adı en az 2 karakter olmalıdır"),
  title: z.string().min(1, "Unvan gereklidir"),
  department: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  terms: z.literal(true, { error: "Kullanım koşullarını kabul etmelisiniz" }),
});

type FormData = z.infer<typeof schema>;

export default function KayitPage() {
  const router = useRouter();
  const { signUp } = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<Partial<FormData>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm((s) => ({ ...s, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Partial<Record<keyof FormData, string>> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as keyof FormData] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setAuthError(null);
    setIsSubmitting(true);
    const data = result.data;
    const error = await signUp(data.email, data.password, {
      name: data.name,
      orgName: data.company,
      title: data.title,
      department: data.department,
      phone: data.phone,
    });
    setIsSubmitting(false);
    if (error) { setAuthError(error); return; }
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>Bu form <strong>yeni bir kuruluş hesabı</strong> oluşturur. Mevcut bir kuruluşa katılmak için yöneticinizden davet linki isteyin.</span>
        </div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Hesap oluşturun</h1>
          <p className="text-gray-500 text-sm">Ücretsiz başlayın. Kredi kartı gerekmez.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {authError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {authError}
            </div>
          )}

          <Input id="name" label="Ad Soyad *" placeholder="Ahmet Yılmaz"
            icon={<User className="w-4 h-4" />} error={errors.name}
            value={(form.name as string) ?? ""} onChange={(e) => set("name", e.target.value)} />

          <Input id="email" label="E-posta *" type="email" placeholder="ahmet@sirket.com"
            icon={<Mail className="w-4 h-4" />} error={errors.email}
            value={(form.email as string) ?? ""} onChange={(e) => set("email", e.target.value)} />

          <Input id="company" label="Şirket / Organizasyon *" placeholder="Şirket Adı A.Ş."
            icon={<LayoutGrid className="w-4 h-4" />} error={errors.company}
            value={(form.company as string) ?? ""} onChange={(e) => set("company", e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Input id="title" label="Unvan *" placeholder="Proje Müdürü"
              icon={<Briefcase className="w-4 h-4" />} error={errors.title}
              value={(form.title as string) ?? ""} onChange={(e) => set("title", e.target.value)} />
            <Input id="department" label="Departman" placeholder="Yazılım"
              icon={<LayoutGrid className="w-4 h-4" />} error={errors.department}
              value={(form.department as string) ?? ""} onChange={(e) => set("department", e.target.value)} />
          </div>

          <Input id="phone" label="Telefon (opsiyonel)" placeholder="+90 555 000 00 00"
            icon={<Phone className="w-4 h-4" />} error={errors.phone}
            value={(form.phone as string) ?? ""} onChange={(e) => set("phone", e.target.value)} />

          <Input id="password" label="Şifre *" type="password" placeholder="En az 8 karakter"
            icon={<Lock className="w-4 h-4" />} error={errors.password}
            value={(form.password as string) ?? ""} onChange={(e) => set("password", e.target.value)} />

          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.terms}
                onChange={(e) => set("terms", e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-indigo-600" />
              <span className="text-sm text-gray-600">
                <Link href="#" className="text-indigo-600 hover:underline">Kullanım Koşulları</Link>
                {" "}ve{" "}
                <Link href="#" className="text-indigo-600 hover:underline">Gizlilik Politikası</Link>
                {"'nı"} okudum ve kabul ediyorum.
              </span>
            </label>
            {errors.terms && <p className="text-xs text-red-500 mt-1">{errors.terms}</p>}
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Hesap Oluştur
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Zaten hesabınız var mı?{" "}
          <Link href="/giris" className="text-indigo-600 font-medium hover:underline">Giriş yapın</Link>
        </p>
      </div>
    </div>
  );
}
