import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "edge";
export const revalidate = 3600; // 1 saat önbellek

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("exchange_rates")
    .select("pair, rate, updated_at");

  if (error || !data?.length) {
    // Supabase erişilemezse varsayılan değerler
    return NextResponse.json({
      EUR_TRY: 38.5,
      USD_TRY: 35.5,
      USD_EUR: 0.923,
      updatedAt: null,
    });
  }

  const byPair = Object.fromEntries(data.map((r) => [r.pair, r]));

  return NextResponse.json({
    EUR_TRY: Number(byPair["EUR_TRY"]?.rate ?? 38.5),
    USD_TRY: Number(byPair["USD_TRY"]?.rate ?? 35.5),
    USD_EUR: Number(byPair["USD_EUR"]?.rate ?? 0.923),
    updatedAt: byPair["EUR_TRY"]?.updated_at ?? null,
  });
}
