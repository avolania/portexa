import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Mehmet Yılmaz",
    title: "CTO, TechStartup A.Ş.",
    initials: "MY",
    color: "bg-indigo-500",
    rating: 5,
    comment:
      "Portexa ile ekibimizin verimliliği %40 arttı. Kanban ve Gantt görünümleri birlikte kullanmak gerçekten muhteşem. AI risk tahminleri sayesinde gecikmelerin önüne geçtik.",
  },
  {
    name: "Ayşe Kara",
    title: "Proje Yöneticisi, Dijital Ajans",
    initials: "AK",
    color: "bg-emerald-500",
    rating: 5,
    comment:
      "Birden fazla projeyi aynı anda yönetmek artık çok kolay. Portföy görünümü bana tüm projelerin durumunu tek bakışta gösteriyor. Zaman takibi ve bütçe modülü de harika.",
  },
  {
    name: "Can Öztürk",
    title: "Freelance Yazılım Geliştirici",
    initials: "CÖ",
    color: "bg-amber-500",
    rating: 5,
    comment:
      "Hem küçük hem büyük projelerim için mükemmel. Özellikle müşterilerimi Misafir rolüyle projeye dahil etmek ve güncel bilgi vermek çok değerli bir özellik.",
  },
];

export default function TestimonialsSection() {
  return (
    <section id="yorumlar" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">
            Kullanıcı Yorumları
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Binlerce ekip tarafından güvenilen platform
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed mb-6 text-sm">{t.comment}</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.title}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
