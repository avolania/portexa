import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col">
      {/* Auth Navbar */}
      <nav className="px-8 py-5 border-b border-gray-100/80">
        <Link href="/" className="inline-flex items-center">
          <Image src="/logo.png" alt="Pixanto" width={400} height={100} unoptimized className="h-14 w-auto object-contain mix-blend-multiply" />
        </Link>
      </nav>

      {/* Auth content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
