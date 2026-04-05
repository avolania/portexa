"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";

const schema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

type FormData = z.infer<typeof schema>;

export default function HelpdeskGirisPage() {
  const { signIn } = useAuthStore();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const error = await signIn(data.email, data.password);
    if (error) {
      setAuthError("E-posta veya şifre hatalı.");
    } else {
      router.replace("/helpdesk/portal");
    }
  };

  return (
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 shadow-xl rounded-2xl overflow-hidden border border-gray-100">
      {/* Sol: Form */}
      <div className="bg-white p-8 lg:p-10 flex flex-col justify-center">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl font-bold text-[#1a2d5a]">Pixanto</span>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">Helpdesk</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hoş geldiniz</h1>
          <p className="text-gray-500 text-sm">
            Destek talebiniz için hesabınıza giriş yapın.
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

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Giriş Yap
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hesabınız yok mu?{" "}
          <Link href="/giris" className="text-indigo-600 font-medium hover:underline">
            Ana giriş sayfasına gidin
          </Link>
        </p>
      </div>

      {/* Sağ: Banner */}
      <div className="hidden lg:flex items-center justify-center bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/helpdesk.banner.png"
          alt="Pixanto"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
