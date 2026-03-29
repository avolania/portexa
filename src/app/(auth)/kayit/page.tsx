"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Lock, Building2, Briefcase, LayoutGrid, Phone, AlertCircle } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";

const schema = z.object({
  name: z.string().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  company: z.string().min(2, "Şirket adı en az 2 karakter olmalıdır"),
  title: z.string().min(1, "Unvan gereklidir"),
  department: z.string().min(1, "Departman gereklidir"),
  phone: z.string().optional(),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  terms: z.literal(true, { error: "Kullanım koşullarını kabul etmelisiniz" }),
});

type FormData = z.infer<typeof schema>;

export default function KayitPage() {
  const router = useRouter();
  const { signUp } = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const error = await signUp(data.email, data.password, {
      name: data.name,
      company: data.company,
      title: data.title,
      department: data.department,
      phone: data.phone,
    });
    if (error) {
      setAuthError(error);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>Bu form <strong>yeni bir kuruluş hesabı</strong> oluşturur. Mevcut bir kuruluşa katılmak için yöneticinizden davet linki isteyin.</span>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hesap oluşturun</h1>
          <p className="text-gray-500 text-sm">Ücretsiz başlayın. Kredi kartı gerekmez.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {authError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                id="name"
                label="Ad Soyad"
                placeholder="Ahmet Yılmaz"
                icon={<User className="w-4 h-4" />}
                error={errors.name?.message}
                {...register("name")}
              />
            </div>
            <div className="col-span-2">
              <Input
                id="email"
                label="E-posta"
                type="email"
                placeholder="ahmet@sirket.com"
                icon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                {...register("email")}
              />
            </div>
            <div className="col-span-2">
              <Input
                id="company"
                label="Şirket / Organizasyon"
                placeholder="Şirket Adı"
                icon={<Building2 className="w-4 h-4" />}
                error={errors.company?.message}
                {...register("company")}
              />
            </div>
            <Input
              id="title"
              label="Unvan"
              placeholder="Proje Müdürü"
              icon={<Briefcase className="w-4 h-4" />}
              error={errors.title?.message}
              {...register("title")}
            />
            <Input
              id="department"
              label="Departman"
              placeholder="Yazılım"
              icon={<LayoutGrid className="w-4 h-4" />}
              error={errors.department?.message}
              {...register("department")}
            />
            <div className="col-span-2">
              <Input
                id="phone"
                label="Telefon (opsiyonel)"
                placeholder="+90 555 000 00 00"
                icon={<Phone className="w-4 h-4" />}
                error={errors.phone?.message}
                {...register("phone")}
              />
            </div>
            <div className="col-span-2">
              <Input
                id="password"
                label="Şifre"
                type="password"
                placeholder="En az 8 karakter"
                icon={<Lock className="w-4 h-4" />}
                error={errors.password?.message}
                {...register("password")}
              />
            </div>
          </div>

          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-indigo-600"
                {...register("terms")}
              />
              <span className="text-sm text-gray-600">
                <Link href="#" className="text-indigo-600 hover:underline">Kullanım Koşulları</Link>
                {" "}ve{" "}
                <Link href="#" className="text-indigo-600 hover:underline">Gizlilik Politikası</Link>
                {"'nı"} okudum ve kabul ediyorum.
              </span>
            </label>
            {errors.terms && <p className="text-xs text-red-500 mt-1">{errors.terms.message}</p>}
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Hesap Oluştur
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">veya</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google ile Kayıt
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          Zaten hesabınız var mı?{" "}
          <Link href="/giris" className="text-indigo-600 font-medium hover:underline">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
