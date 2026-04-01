"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#1a2d5a] flex items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Pixanto" width={36} height={36} unoptimized className="object-cover w-full h-full" />
            </div>
            <span className="text-lg font-bold text-[#1a2d5a]">Pixanto</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#ozellikler" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Özellikler
            </Link>
            <Link href="#nasil-calisir" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Nasıl Çalışır
            </Link>
            <Link href="#yorumlar" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Yorumlar
            </Link>
            <Link href="#sss" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              SSS
            </Link>
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/giris">
              <Button variant="ghost" size="sm">Giriş Yap</Button>
            </Link>
            <Link href="/kayit">
              <Button size="sm">Ücretsiz Başla</Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-3">
          <Link href="#ozellikler" className="text-sm text-gray-600 py-2" onClick={() => setIsOpen(false)}>Özellikler</Link>
          <Link href="#nasil-calisir" className="text-sm text-gray-600 py-2" onClick={() => setIsOpen(false)}>Nasıl Çalışır</Link>
          <Link href="#yorumlar" className="text-sm text-gray-600 py-2" onClick={() => setIsOpen(false)}>Yorumlar</Link>
          <Link href="#sss" className="text-sm text-gray-600 py-2" onClick={() => setIsOpen(false)}>SSS</Link>
          <hr className="border-gray-100" />
          <Link href="/giris"><Button variant="outline" className="w-full">Giriş Yap</Button></Link>
          <Link href="/kayit"><Button className="w-full">Ücretsiz Başla</Button></Link>
        </div>
      )}
    </nav>
  );
}
