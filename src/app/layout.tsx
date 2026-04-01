import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StoreHydration from "@/components/StoreHydration";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pixanto — Proje ve Portföy Yönetimi",
  description:
    "Projelerinizi tek bir platformda yönetin. Kanban, Gantt, zaman takibi, bütçe ve AI destekli önerilerle ekibinizin verimliliğini artırın.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-50 antialiased`}>
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
