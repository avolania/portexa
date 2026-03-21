"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const schema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
});

type FormData = z.infer<typeof schema>;

export default function SifremiUnuttumPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async () => {
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">E-posta gönderildi</h2>
            <p className="text-sm text-gray-500 mb-6">
              Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.
            </p>
            <Link href="/giris">
              <Button variant="secondary" className="w-full">Giriş sayfasına dön</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Şifremi unuttum</h1>
              <p className="text-gray-500 text-sm">
                E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.
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
              <Button type="submit" className="w-full" loading={isSubmitting}>
                Sıfırlama Bağlantısı Gönder
              </Button>
            </form>

            <Link
              href="/giris"
              className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Giriş sayfasına dön
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
