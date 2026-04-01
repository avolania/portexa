import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col">
      {/* Auth Navbar */}
      <nav className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#1a2d5a] flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Pixanto" width={36} height={36} unoptimized className="object-cover w-full h-full" />
          </div>
          <span className="text-lg font-bold text-[#1a2d5a]">Pixanto</span>
        </Link>
      </nav>

      {/* Auth content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
