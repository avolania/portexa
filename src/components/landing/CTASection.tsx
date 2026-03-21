import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";

export default function CTASection() {
  return (
    <section className="py-24 bg-indigo-600 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500 rounded-full opacity-30 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500 rounded-full opacity-20 blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
          Projelerinizi kontrol altına alın — hemen başlayın
        </h2>
        <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto">
          Dakikalar içinde kurulum yapın. Kredi kartı gerekmez, süresiz ücretsiz başlayın.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/kayit">
            <Button
              size="lg"
              className="bg-white text-indigo-600 hover:bg-indigo-50 focus:ring-white px-8 py-3 text-base"
            >
              Ücretsiz Başla
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
          <Link href="/giris">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-indigo-500 border border-indigo-400 px-8 py-3 text-base"
            >
              Giriş Yap
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
