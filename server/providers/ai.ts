import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { config } from '../config.ts';
import { logApi, NotConfiguredError } from './fetcher.ts';

/**
 * Gemini adapter. The key never leaves the server. All structured outputs are
 * validated with zod before use; anything that fails validation is treated as
 * a failed analysis, never patched up with invented values.
 */

let client: GoogleGenAI | null = null;
function ai() {
  if (!config.gemini.apiKey) {
    throw new NotConfiguredError('Gemini AI', 'Create a key at https://aistudio.google.com/apikey and set GEMINI_API_KEY.');
  }
  // Fail fast on a busy model (no library retries) so generate() can switch to the fallback model.
  if (!client) client = new GoogleGenAI({ apiKey: config.gemini.apiKey, httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } } });
  return client;
}

export const aiConfigured = () => !!config.gemini.apiKey;

const isOverloaded = (e: any) => [408, 429, 500, 502, 503, 504].includes(e?.status) || /UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|timed? ?out|abort/i.test(String(e?.message ?? e?.name));

/** Calls the main model, and the fallback model once if Google reports it overloaded. */
async function generate(params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>) {
  const models = [...new Set([config.gemini.model, config.gemini.fallbackModel].filter(Boolean))];
  let last: unknown;
  for (const model of models) {
    try {
      return { res: await ai().models.generateContent({ ...params, model }), model };
    } catch (e) {
      last = e;
      if (!isOverloaded(e)) throw e;
    }
  }
  throw last;
}

// ---------------- Crop diagnosis ----------------

export const DiagnosisSchema = z.object({
  image_quality: z.enum(['good', 'acceptable', 'poor', 'not_a_plant']),
  crop_identified: z.string().nullable(),
  crop_matches_selection: z.boolean().nullable(),
  primary_issue: z
    .object({
      name: z.string(),
      type: z.enum(['disease', 'pest', 'nutrient_deficiency', 'abiotic_stress', 'healthy', 'unknown']),
      confidence: z.number().min(0).max(1),
    })
    .nullable(),
  visual_symptoms: z.array(z.string()),
  alternative_causes: z.array(z.object({ name: z.string(), reason: z.string() })),
  severity: z.enum(['low', 'moderate', 'high', 'uncertain']),
  environmental_factors: z.array(z.string()),
  immediate_actions: z.array(z.string()),
  prevention: z.array(z.string()),
  treatment_options: z.array(z.string()),
  follow_up_questions: z.array(z.string()),
  expert_review_recommended: z.boolean(),
  retake_guidance: z.string().nullable(),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

const diagnosisJsonSchema = {
  type: 'object',
  properties: {
    image_quality: { type: 'string', enum: ['good', 'acceptable', 'poor', 'not_a_plant'] },
    crop_identified: { type: ['string', 'null'] },
    crop_matches_selection: { type: ['boolean', 'null'] },
    primary_issue: {
      type: ['object', 'null'],
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['disease', 'pest', 'nutrient_deficiency', 'abiotic_stress', 'healthy', 'unknown'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['name', 'type', 'confidence'],
    },
    visual_symptoms: { type: 'array', items: { type: 'string' } },
    alternative_causes: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] },
    },
    severity: { type: 'string', enum: ['low', 'moderate', 'high', 'uncertain'] },
    environmental_factors: { type: 'array', items: { type: 'string' } },
    immediate_actions: { type: 'array', items: { type: 'string' } },
    prevention: { type: 'array', items: { type: 'string' } },
    treatment_options: { type: 'array', items: { type: 'string' } },
    follow_up_questions: { type: 'array', items: { type: 'string' } },
    expert_review_recommended: { type: 'boolean' },
    retake_guidance: { type: ['string', 'null'] },
  },
  required: [
    'image_quality', 'crop_identified', 'crop_matches_selection', 'primary_issue', 'visual_symptoms', 'alternative_causes',
    'severity', 'environmental_factors', 'immediate_actions', 'prevention', 'treatment_options', 'follow_up_questions',
    'expert_review_recommended', 'retake_guidance',
  ],
};

const DIAGNOSIS_SYSTEM = `You are a cautious plant-health assistant for Indian smallholder farmers.
Analyse the photo and give a PRELIMINARY assessment only.
Rules:
- If the photo is blurry, too dark, too far away, or not a plant, set image_quality to "poor" or "not_a_plant", leave primary_issue null and explain how to retake in retake_guidance.
- Never invent a diagnosis. If you are unsure, use type "unknown", a low confidence, and set expert_review_recommended true.
- confidence must honestly reflect uncertainty from a single image.
- treatment_options: prefer cultural, mechanical and biological measures. You may name a chemical group only in general terms and must say to use only products registered for the crop in India and to follow the label. NEVER give doses, mixing ratios, or tank-mix instructions.
- Severity "uncertain" unless clearly visible.
- Write in the language requested.`;

export async function diagnoseImage(input: {
  imageBase64: string; mime: string; crop?: string; plantPart?: string; stage?: string; symptoms?: string; language: string; weatherSummary?: string;
}): Promise<{ result: Diagnosis; model: string }> {
  const started = Date.now();
  const context = [
    input.crop && `Farmer-selected crop: ${input.crop}`,
    input.plantPart && `Affected part: ${input.plantPart}`,
    input.stage && `Growth stage: ${input.stage}`,
    input.symptoms && `Farmer-reported symptoms: ${input.symptoms}`,
    input.weatherSummary && `Recent local weather (Open-Meteo): ${input.weatherSummary}`,
    `Respond in language code: ${input.language}`,
  ].filter(Boolean).join('\n');
  try {
    const { res, model } = await generate({
      contents: [{ role: 'user', parts: [{ inlineData: { data: input.imageBase64, mimeType: input.mime } }, { text: context }] }],
      config: {
        systemInstruction: DIAGNOSIS_SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: diagnosisJsonSchema,
        temperature: 0.2,
      },
    });
    const parsed = DiagnosisSchema.parse(JSON.parse(res.text || '{}'));
    logApi('gemini', 'diagnosis', true, Date.now() - started);
    return { result: parsed, model };
  } catch (e: any) {
    logApi('gemini', 'diagnosis', false, Date.now() - started, e?.message);
    throw e;
  }
}

// ---------------- Assistant ----------------

export const ASSISTANT_SYSTEM = `You are "Medha AI", the FARMDirect agricultural assistant for Indian farmers.
- Answer only farming-related questions (crops, soil, water, weather interpretation, pests, diseases, markets, schemes, post-harvest, sustainable practice).
- Use simple language and short steps. Reply in the user's language.
- The VERIFIED DATA block contains real data from our services with its source and timestamp. Use only that for weather, prices and scheme facts. If data is missing, say so plainly — NEVER invent weather, prices, scheme eligibility, dates, or citations.
- When you rely on VERIFIED DATA or an ADVISORY RECORD, cite it inline like [source: Open-Meteo] or [advisory: title].
- Clearly mark your own general suggestions as "General suggestion (AI)".
- Never give pesticide doses, mixing ratios, or tank-mix instructions; tell the farmer to follow the product label and consult the local agriculture officer / KVK.
- Ask a short clarifying question when the crop, stage or location is unclear.
- You cannot take actions. NEVER say you have booked storage, listed or sold produce, accepted an offer, placed an order, made a payment, or contacted anyone. Instead explain the steps and tell the user which FARMDirect screen to open; the app shows buttons for those screens. The user confirms every action on that screen.
- Marketplace, storage and diagnosis facts in VERIFIED DATA come from the user's own FARMDirect records. Farmer-reported grades are not inspected grades. Crop Doctor results are AI photo checks, not lab confirmation. Storage availability must be checked before booking.
- Any number you estimate yourself (yield, income, quantity) must be labelled "AI estimate" with the assumptions.
- If the question involves a severe or spreading crop problem, livestock/human health, poisoning, or a high-value decision you cannot verify, recommend contacting an expert and start the reply with [ESCALATE].`;

export async function chat(history: { role: 'user' | 'assistant'; content: string }[], contextBlock: string) {
  const started = Date.now();
  // Gemini expects the conversation to start with a user turn.
  const turns = [...history];
  while (turns.length && turns[0].role === 'assistant') turns.shift();
  try {
    const { res } = await generate({
      contents: turns.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      // Newer models spend part of this budget on internal reasoning, and Indian scripts use
      // more tokens per word, so the limit is generous; the prompt asks for short answers.
      config: { systemInstruction: `${ASSISTANT_SYSTEM}\n\n${contextBlock}`, temperature: 0.4, maxOutputTokens: 8192 },
    });
    const text = res.text?.trim() || '';
    const cut = res.candidates?.[0]?.finishReason === 'MAX_TOKENS';
    logApi('gemini', 'chat', true, Date.now() - started, cut ? 'reply cut at token limit' : undefined);
    return cut && text ? `${text}…\n\n(This answer was cut short. Ask "continue" to see the rest.)` : text;
  } catch (e: any) {
    logApi('gemini', 'chat', false, Date.now() - started, e?.message);
    throw e;
  }
}
