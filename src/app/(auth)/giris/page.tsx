"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";
import { loadDemoData } from "@/lib/loadDemoData";
import { DEMO_USER } from "@/lib/demoData";

const schema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

type FormData = z.infer<typeof schema>;

export default function GirisPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await new Promise((r) => setTimeout(r, 600));
    // Kaydedilmiş profili bul: önce aktif user, sonra profiles haritası
    const state = useAuthStore.getState();
    const saved =
      (state.user?.email === data.email ? state.user : null) ??
      state.profiles?.[data.email] ??
      null;
    login({
      id: saved?.id ?? crypto.randomUUID(),
      name: saved?.name ?? "Kullanıcı",
      email: data.email,
      role: saved?.role ?? "admin",
      language: saved?.language ?? "tr",
      title: saved?.title,
      department: saved?.department,
      company: saved?.company,
      phone: saved?.phone,
      rememberMe,
    });
    router.push("/dashboard");
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    login(DEMO_USER);
    loadDemoData();
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hoş geldiniz</h1>
          <p className="text-gray-500 text-sm">
            Hesabınıza giriş yapın ve projelerinizi yönetin.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            label="E-posta"
            type="email"
            placeholder="ornek@sirket.com"
            icon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register("email")}
          />

          <div>
            <Input
              id="password"
              label="Şifre"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              Beni hatırla
            </label>
            <Link href="/sifremi-unuttum" className="text-sm text-indigo-600 hover:underline">
              Şifremi unuttum
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Giriş Yap
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">veya</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-3">
          {/* Demo login */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {demoLoading ? "Yükleniyor..." : "Demo Hesabıyla Dene"}
          </button>

          <button className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google ile Giriş
          </button>
          <button className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078d4">
              <path d="M11.5 2.5L2 7.5v9l9.5 5 9.5-5v-9z" />
            </svg>
            Microsoft ile Giriş
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className="text-indigo-600 font-medium hover:underline">
            Ücretsiz kayıt olun
          </Link>
        </p>
      </div>
    </div>
  );
}
