import Anthropic from '@anthropic-ai/sdk';
import type { Messages } from '@anthropic-ai/sdk/resources/index.js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractCoaFromPdf(
  fileRef: string,
  specAttributes: string[]
): Promise<Array<{ attribute_key: string; reported_value: string; unit: string | null }>> {
  // Download file from Supabase Storage
  const { data, error } = await supabaseAdmin.storage
    .from('qms-documents')
    .download(fileRef);

  if (error || !data) {
    throw new Error(`Dosya indirilemedi: ${error?.message ?? 'Bilinmeyen hata'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const attributeList = specAttributes.length > 0
    ? `The following attribute keys are expected (match them where possible): ${specAttributes.join(', ')}`
    : 'Extract all test results you find.';

  const documentBlock: Messages.DocumentBlockParam = {
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: base64,
    },
  };

  const textBlock: Messages.TextBlockParam = {
    type: 'text',
    text: `Extract all test results from this Certificate of Analysis document. ${attributeList}

Return a JSON array in this exact format:
[
  { "attribute_key": "moisture", "reported_value": "5.2", "unit": "%" },
  { "attribute_key": "protein", "reported_value": "12.4", "unit": "g/100g" }
]

Rules:
- attribute_key should be snake_case and match the expected attributes where possible
- reported_value should be the numeric or text value only (no units)
- unit should be the unit string or null if no unit
- Return ONLY the JSON array, no other text`,
  };

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: 'You are a food safety quality analyst. Extract test results from this Certificate of Analysis. Return ONLY a valid JSON array with no additional text.',
    messages: [
      {
        role: 'user',
        content: [documentBlock, textBlock] as Messages.ContentBlockParam[],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error("Claude'dan metin yanıtı alınamadı");
  }

  const rawText = textContent.text.trim();

  // Extract JSON from response (in case there's any surrounding text)
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Yanıttan JSON array çıkarılamadı');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('JSON parse hatası: ' + jsonMatch[0].slice(0, 200));
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Yanıt bir array değil');
  }

  return parsed.map((item: unknown) => {
    const obj = item as Record<string, unknown>;
    return {
      attribute_key: String(obj.attribute_key ?? ''),
      reported_value: String(obj.reported_value ?? ''),
      unit: obj.unit ? String(obj.unit) : null,
    };
  });
}
