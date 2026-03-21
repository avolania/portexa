import {
  LayoutDashboard, GitBranch, Users, Clock,
  DollarSign, Sparkles, MessageSquare, FileText
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Proje Yönetimi",
    description: "Kanban, Gantt ve Liste görünümleriyle görevlerinizi esnek biçimde yönetin.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: GitBranch,
    title: "Portföy Takibi",
    description: "Tüm projelerinizi kuş bakışı izleyin, karşılaştırın ve analiz edin.",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    icon: Users,
    title: "Ekip Yönetimi",
    description: "Kaynak ataması ve iş yükü dengeleme ile ekibinizi verimli kullanın.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Clock,
    title: "Zaman Takibi",
    description: "Otomatik zamanlayıcı ve manuel timesheet ile çalışılan süreleri kaydedin.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: DollarSign,
    title: "Bütçe Kontrolü",
    description: "Gelir-gider takibi, maliyet analizi ve akıllı bütçe uyarıları.",
    color: "bg-pink-50 text-pink-600",
  },
  {
    icon: Sparkles,
    title: "AI Destekli Öneriler",
    description: "Akıllı risk tahmini, kaynak önerileri ve süre tahminleriyle bir adım önde olun.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: MessageSquare,
    title: "Gerçek Zamanlı İşbirliği",
    description: "Yorum, chat ve canlı güncellemelerle ekibinizle senkron çalışın.",
    color: "bg-sky-50 text-sky-600",
  },
  {
    icon: FileText,
    title: "Raporlama",
    description: "Profesyonel PDF ve Excel raporları oluşturun, otomatik gönderin.",
    color: "bg-orange-50 text-orange-600",
  },
];

export default function FeaturesSection() {
  return (
    <section id="ozellikler" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            Özellikler
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Projeleri yönetmek için ihtiyacınız olan her şey
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Bireysel freelancerlardan büyük ekiplere kadar herkese uygun güçlü araçlar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
