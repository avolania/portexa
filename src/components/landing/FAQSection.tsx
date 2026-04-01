"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Pixanto hangi ekip büyüklüklerine uygun?",
    a: "Bireysel freelancerlardan 500+ kişilik kurumsal ekiplere kadar her ölçeğe uygundur. Rol sistemi ve yetki yapısı ihtiyacınıza göre esnek şekilde yapılandırılabilir.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Tüm veriler SSL/TLS şifrelemesiyle aktarılır ve AES-256 ile depolanır. GDPR uyumlu altyapımız ve günlük otomatik yedekleme sistemiyle verileriniz koruma altındadır.",
  },
  {
    q: "Mevcut araçlarımla entegre edebilir miyim?",
    a: "Evet. Slack, Jira, Google Workspace, Microsoft 365, GitHub/GitLab ve Zapier/Make entegrasyonları mevcuttur. Ayrıca Public API ve Webhook desteğiyle özel entegrasyon oluşturabilirsiniz.",
  },
  {
    q: "Mobil cihazlardan erişebilir miyim?",
    a: "Tüm özellikler tam responsive tasarımla mobil tarayıcılardan kullanılabilir. iOS ve Android uygulamaları yakında yayımlanacak.",
  },
  {
    q: "Hangi dilleri destekliyorsunuz?",
    a: "Türkçe ve İngilizce tam dil desteği mevcuttur. Kullanıcı ve organizasyon bazında dil seçimi yapılabilir.",
  },
  {
    q: "Veri dışa aktarma yapabilir miyim?",
    a: "Evet. Tüm raporlarınızı PDF veya Excel formatında dışa aktarabilirsiniz. Ham veri için CSV dışa aktarma da mevcuttur.",
  },
  {
    q: "Fiyatlandırma nasıl çalışıyor?",
    a: "Şu anda platform tüm özelliklerle ücretsiz sunulmaktadır. İlerleyen dönemde eklenmesi planlanan ücretli planlardan önce mevcut kullanıcılara özel koşullar sunulacak.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="sss" className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">SSS</p>
          <h2 className="text-4xl font-bold text-gray-900">Sıkça sorulan sorular</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-sm font-semibold text-gray-900">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
