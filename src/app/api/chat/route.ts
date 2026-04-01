import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, context } = await req.json();

  const system = `Sen Pixanto adlı bir proje yönetim platformunun asistanısın. Kullanıcının görev ve projelerini takip etmesine, raporlar oluşturmasına, ekip üyelerini yönetmesine yardımcı olursun. Kısa, net ve yardımsever cevaplar ver. Türkçe konuş.

Mevcut bağlam:
${context}`;

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
