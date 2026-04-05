"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";

const schema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

type FormData = z.infer<typeof schema>;

export default function GirisPage() {
  const router = useRouter();
  const { signIn, isAuthenticated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const error = await signIn(data.email, data.password);
    if (error) {
      setAuthError(error);
    }
  };

  return (
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 shadow-xl rounded-2xl overflow-hidden border border-gray-100">
      {/* Left: form */}
      <div className="bg-white p-8 lg:p-10 flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hoş geldiniz</h1>
          <p className="text-gray-500 text-sm">
            Hesabınıza giriş yapın ve projelerinizi yönetin.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {authError}
            </div>
          )}
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

        <p className="mt-6 text-center text-sm text-gray-500">
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className="text-indigo-600 font-medium hover:underline">
            Ücretsiz kayıt olun
          </Link>
        </p>
      </div>

      {/* Right: banner */}
      <div className="hidden lg:flex items-center justify-center bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banner.png"
          alt="Pixanto"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
