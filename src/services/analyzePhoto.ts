import { getOpenAI } from '../lib/openai';
import logger from '../lib/logger';

export interface AnalysisResult {
  verdict: 'mess' | 'clean' | 'unclear';
  title: string;
  description: string;
  bettingIndex: number;
}

const SYSTEM_PROMPT = `Tu esi namų tvarkos vertintojas. Gavęs nuotrauką, įvertink ar joje matoma netvarka.

Atsakyk JSON formatu su šiais laukais:
- "verdict": "mess" jei matoma netvarka, "clean" jei tvarkinga, "unclear" jei neįmanoma nustatyti
- "title": trumpas pavadinimas lietuvių kalba (iki 60 simbolių), apibūdinantis situaciją
- "description": detalus aprašymas lietuvių kalba (1-2 sakiniai), ką matai nuotraukoje
- "bettingIndex": skaičius nuo 1 iki 10, kur 1 = labai maža netvarka, 10 = katastrofa. Jei verdict yra "clean" arba "unclear", bettingIndex turi būti 1.

Atsakyk TIK JSON objektu, be jokio papildomo teksto.`;

export async function analyzePhoto(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<AnalysisResult> {
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  let response;
  try {
    response = await getOpenAI().chat.completions.create(
      {
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'low' },
              },
            ],
          },
        ],
        max_tokens: 300,
      },
      { signal: controller.signal },
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI negrąžino atsakymo');
  }

  const parsed = JSON.parse(content) as AnalysisResult;

  if (!parsed.verdict || !parsed.title || !parsed.description || !parsed.bettingIndex) {
    throw new Error('OpenAI atsakyme trūksta privalomų laukų');
  }

  if (!['mess', 'clean', 'unclear'].includes(parsed.verdict)) {
    throw new Error(`Netinkamas verdict: ${parsed.verdict}`);
  }

  if (parsed.bettingIndex < 1 || parsed.bettingIndex > 10) {
    parsed.bettingIndex = Math.max(1, Math.min(10, Math.round(parsed.bettingIndex)));
  }

  logger.info(
    { verdict: parsed.verdict, bettingIndex: parsed.bettingIndex },
    'Nuotraukos analizė baigta',
  );

  return parsed;
}
