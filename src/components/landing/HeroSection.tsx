import Link from "next/link";
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

        {/* App mockup */}
        <div className="mt-16 relative">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Browser bar */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 mx-4 border border-gray-200">
                app.pixanto.app/dashboard
              </div>
            </div>
            {/* Fake dashboard preview */}
            <div className="p-6 bg-gray-50 min-h-64">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Aktif Proje", value: "12", color: "bg-indigo-500" },
                  { label: "Açık Görev", value: "48", color: "bg-amber-500" },
                  { label: "Bu Hafta Tamamlanan", value: "23", color: "bg-emerald-500" },
                  { label: "Yaklaşan Deadline", value: "5", color: "bg-red-500" },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className={`w-8 h-1 ${card.color} rounded-full mb-3`} />
                    <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Bana Atanan Görevler</div>
                  {[
                    { title: "Ana sayfa tasarımını tamamla", badge: "Devam Ediyor", color: "bg-blue-100 text-blue-700" },
                    { title: "Ödeme entegrasyonu", badge: "Yapılacak", color: "bg-gray-100 text-gray-600" },
                    { title: "API dokümantasyonu", badge: "İncelemede", color: "bg-amber-100 text-amber-700" },
                  ].map((task) => (
                    <div key={task.title} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{task.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${task.color}`}>{task.badge}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Proje Durumları</div>
                  <div className="space-y-2">
                    {[
                      { label: "Aktif", pct: 50, color: "bg-emerald-500" },
                      { label: "Riskli", pct: 25, color: "bg-red-500" },
                      { label: "Beklemede", pct: 25, color: "bg-gray-300" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${s.color}`} />
                        <span className="text-xs text-gray-600">{s.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 ml-auto w-16">
                          <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shadow glow */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-indigo-200 blur-2xl opacity-40 -z-10" />
        </div>
      </div>
    </section>
  );
}
