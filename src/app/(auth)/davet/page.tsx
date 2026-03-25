"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, User, AlertCircle, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";

const schema = z.object({
  name: z.string().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
});

type FormData = z.infer<typeof schema>;

interface InviteInfo {
  email: string;
  orgId: string;
  orgName: string;
}

function DavetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { signUpWithInvitation } = useAuthStore();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Token doğrula
  useEffect(() => {
    if (!token) {
      setValidateError("Geçersiz davet linki.");
      return;
    }
    fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setValidateError(data.error as string);
        } else {
          setInviteInfo(data as InviteInfo);
        }
      })
      .catch(() => setValidateError("Davet doğrulanamadı."));
  }, [token]);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const error = await signUpWithInvitation(token, data.name, data.password);
    if (error) {
      setAuthError(error);
      return;
    }
    setDone(true);
  };

  // Hata durumu
  if (validateError) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Geçersiz Davet</h1>
          <p className="text-gray-500 text-sm">{validateError}</p>
        </div>
      </div>
    );
  }

  // Yükleniyor
  if (!inviteInfo) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <p className="text-gray-500">Davet doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  // Başarılı kayıt
  if (done) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Hesabınız oluşturuldu!</h1>
          <p className="text-gray-500 text-sm mb-6">
            E-posta adresinize bir onay linki gönderdik. Onayladıktan sonra giriş yapabilirsiniz.
          </p>
          <Button onClick={() => router.push("/giris")} className="w-full">
            Giriş Sayfasına Git
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            Davet
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {inviteInfo.orgName}&apos;e katılın
          </h1>
          <p className="text-gray-500 text-sm">
            <span className="font-medium text-gray-700">{inviteInfo.email}</span> için hesabınızı oluşturun.
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
            id="name"
            label="Ad Soyad"
            placeholder="Ahmet Yılmaz"
            icon={<User className="w-4 h-4" />}
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            id="password"
            label="Şifre"
            type="password"
            placeholder="En az 8 karakter"
            icon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            {...register("password")}
          />

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Hesap Oluştur ve Katıl
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function DavetPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <p className="text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    }>
      <DavetContent />
    </Suspense>
  );
}
