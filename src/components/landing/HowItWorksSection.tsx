import { UserPlus, Settings, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Kayıt Ol",
    description: "Hesabını oluştur ve ekibini davet et. 5 dakikadan kısa sürer, kredi kartı gerekmez.",
    color: "bg-indigo-600",
  },
  {
    icon: Settings,
    step: "02",
    title: "Projeni Kur",
    description: "Görevleri, bütçeyi ve zaman çizelgesini tanımla. Hazır şablonlarla hızlı başla.",
    color: "bg-cyan-500",
  },
  {
    icon: BarChart3,
    step: "03",
    title: "Yönet & Takip Et",
    description: "Gerçek zamanlı paneller ve AI önerileriyle her şeyi kontrol altında tut.",
    color: "bg-emerald-500",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="nasil-calisir" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            Nasıl Çalışır
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            3 adımda başla
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Dakikalar içinde kurulum yapın, saatler içinde üretkenliğinizi artırın.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-gradient-to-r from-indigo-200 via-cyan-200 to-emerald-200" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="flex flex-col items-center text-center relative">
                <div className={`w-20 h-20 ${step.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg relative z-10`}>
                  <Icon className="w-10 h-10 text-white" />
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-white border-2 border-gray-100 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xs font-bold text-gray-700">{i + 1}</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed max-w-xs">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
