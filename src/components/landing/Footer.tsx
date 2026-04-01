import Link from "next/link";
import Image from "next/image";
import { Twitter, Linkedin, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="Pixanto" width={36} height={36} unoptimized className="object-contain" />
              <span className="text-white font-bold text-lg">Pixanto</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Projelerinizi ve portföyünüzü tek bir güçlü platformda yönetin.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Ürün</h4>
            <ul className="space-y-3 text-sm">
              {["Özellikler", "Nasıl Çalışır", "Entegrasyonlar", "Şablonlar", "Fiyatlandırma"].map((item) => (
                <li key={item}>
                  <Link href="#" className="hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Şirket</h4>
            <ul className="space-y-3 text-sm">
              {["Hakkımızda", "Blog", "Kariyer", "İletişim", "Basın"].map((item) => (
                <li key={item}>
                  <Link href="#" className="hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Destek</h4>
            <ul className="space-y-3 text-sm">
              {["Yardım Merkezi", "API Dokümantasyon", "Durum Sayfası", "Gizlilik Politikası", "Kullanım Koşulları"].map((item) => (
                <li key={item}>
                  <Link href="#" className="hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">© 2026 Pixanto. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-4 text-sm">
            <button className="flex items-center gap-1.5 hover:text-white transition-colors">
              🇹🇷 Türkçe
            </button>
            <span className="text-gray-700">|</span>
            <button className="flex items-center gap-1.5 hover:text-white transition-colors">
              🇬🇧 English
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
