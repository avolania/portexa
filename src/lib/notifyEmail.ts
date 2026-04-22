import { supabase } from "./supabase";
import type { NotifyType } from "@/app/api/notify/route";

// Fire-and-forget: hata olsa bile ana işlemi engellemez.
export async function notifyEmail(
  type: NotifyType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    await fetch("/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // Bildirim hatası ana işlemi kesmez
  }
}
