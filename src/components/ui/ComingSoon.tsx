import Link from "next/link";
import Button from "./Button";

interface Props {
  title: string;
  description: string;
  icon: string;
}

export default function ComingSoon({ title, description, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 text-center px-4">
      <div className="text-6xl mb-5">{icon}</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 max-w-sm mb-6 text-sm leading-relaxed">{description}</p>
      <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full mb-8">
        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
        Yakında geliyor — Faz 2
      </div>
      <Link href="/dashboard">
        <Button variant="secondary" size="sm">Dashboard'a Dön</Button>
      </Link>
    </div>
  );
}
