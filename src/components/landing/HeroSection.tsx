import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";

export default function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #e0e7ff 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-sm text-indigo-700 font-medium">Yeni — AI destekli proje yönetimi</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Projelerinizi{" "}
            <span className="text-indigo-600">tek bir platformda</span>{" "}
            yönetin
          </h1>

          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Ekibinizle gerçek zamanlı iş birliği yapın, görevleri takip edin,
            bütçenizi kontrol altında tutun ve AI destekli önerilerle projelerinizi
            başarıya taşıyın.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/kayit">
              <Button size="lg" className="gap-2 px-8 py-3 text-base">
                Ücretsiz Başla
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <button className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition-colors group">
              <div className="w-11 h-11 rounded-full border-2 border-gray-300 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                <Play className="w-4 h-4 ml-0.5" />
              </div>
              <span className="text-sm font-medium">Demo İzle</span>
            </button>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            {["Kredi kartı gerekmez", "5 dakikada kurulum", "7/24 destek"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* App banner */}
        <div className="mt-16 relative">
          <div className="rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <Image
              src="/banner.png"
              alt="Pixanto platform görünümü"
              width={1200}
              height={675}
              unoptimized
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Shadow glow */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-indigo-200 blur-2xl opacity-40 -z-10" />
        </div>
      </div>
    </section>
  );
}
