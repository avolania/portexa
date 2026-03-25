"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const schema = z
  .object({
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Şifreler eşleşmiyor",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export default function SifreSifirlaPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase redirects here with a hash fragment containing the access_token.
    // onAuthStateChange fires a PASSWORD_RECOVERY event which sets the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setAuthError(error.message);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => router.push("/giris"), 2000);
  };

  if (done) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Şifre güncellendi</h2>
          <p className="text-sm text-gray-500">Yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Yeni şifre belirleyin</h1>
          <p className="text-gray-500 text-sm">En az 8 karakter kullanın.</p>
        </div>

        {!ready && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            Bağlantı doğrulanıyor...
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {authError}
            </div>
          )}
          <Input
            id="password"
            label="Yeni Şifre"
            type="password"
            placeholder="En az 8 karakter"
            icon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            {...register("password")}
          />
          <Input
            id="confirm"
            label="Şifre Tekrar"
            type="password"
            placeholder="Şifrenizi tekrar girin"
            icon={<Lock className="w-4 h-4" />}
            error={errors.confirm?.message}
            {...register("confirm")}
          />
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!ready}>
            Şifreyi Güncelle
          </Button>
        </form>
      </div>
    </div>
  );
}
