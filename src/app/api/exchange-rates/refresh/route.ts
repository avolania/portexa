import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Vercel cron bu endpoint'i her gün 06:00 UTC'de çağırır.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Frankfurter (ECB verileri, ücretsiz, API key gerektirmez)
  const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=TRY,USD", {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Frankfurter API hatası" }, { status: 502 });
  }

  const json = await res.json();
  const eurTry: number = json.rates.TRY;
  const eurUsd: number = json.rates.USD;

  const rates = [
    { pair: "EUR_TRY", rate: eurTry },
    { pair: "USD_TRY", rate: eurTry / eurUsd },      // USD/TRY = EUR/TRY ÷ EUR/USD
    { pair: "USD_EUR", rate: 1 / eurUsd },            // USD/EUR = 1 ÷ EUR/USD
  ];

  const { error } = await supabaseAdmin
    .from("exchange_rates")
    .upsert(
      rates.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: "pair" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: json.date, rates });
}
