import { getOpenAI } from '../lib/openai';
import logger from '../lib/logger';

export interface AnalysisResult {
  verdict: 'mess' | 'clean' | 'unclear';
  title: string;
  description: string;
  bettingIndex: number;
}

const SYSTEM_PROMPT = `Tu esi namų ruošos užduočių generatorius. Gavęs nuotrauką, tu turi:
1. Nustatyti ar joje matoma netvarka arba nepadaryta namų ruoša
2. Sugeneruoti konkrečią užduotį (quest), kurią reikia atlikti

Svarbu: vertink KONTEKSTĄ — ne tik ar daiktas matomas, bet ar jis yra ne savo vietoje arba reikalauja veiksmų. Pvz., kojinė ant grindų = netvarka, kojinė stalčiuje = tvarka.

Atsakyk JSON formatu su šiais laukais:
- "verdict": "mess" jei matoma netvarka/nepadaryta ruoša, "clean" jei viskas tvarkinga, "unclear" jei neįmanoma nustatyti
- "title": trumpa užduotis lietuvių kalba (iki 60 simbolių), formuluota kaip veiksmas. Pavyzdžiai: "Išplauti lėkštes kriauklėje", "Surinkti drabužius nuo grindų", "Išnešti šiukšles"
- "description": 1-2 sakiniai lietuvių kalba, paaiškinantys KĄ reikia padaryti ir KODĖL (kas negerai). Pvz.: "Kriauklėje sukrautos nešvarios lėkštės ir puodeliai, kuriuos reikia išplauti ir sudėti į džiovyklą."
- "bettingIndex": skaičius nuo 1 iki 10, vertinantis užduoties sudėtingumą pagal: laiką (kiek užtruks), pastangas (fizinis darbas), nemalonumą (pvz., šiukšlės = nemaloniau nei dulkių valymas). 1 = triviali užduotis (pakelti vieną daiktą), 5 = vidutinė (išplauti indus), 10 = didžiulė užduotis (generalinis valymas). Jei verdict yra "clean" arba "unclear", bettingIndex turi būti 1.

Atsakyk TIK JSON objektu, be jokio papildomo teksto.`;

export async function analyzePhoto(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<AnalysisResult> {
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const FIRST_CHUNK_TIMEOUT_MS = 20000;
  const IDLE_TIMEOUT_MS = 5000;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const armTimer = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), ms);
  };

  let content = '';
  try {
    armTimer(FIRST_CHUNK_TIMEOUT_MS);
    const stream = await getOpenAI().chat.completions.create(
      {
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        stream: true,
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

    for await (const chunk of stream) {
      armTimer(IDLE_TIMEOUT_MS);
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) content += delta;
    }
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('AI_TIMEOUT', { cause: err });
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!content) {
    throw new Error('OpenAI negrąžino atsakymo');
  }

  const parsed = JSON.parse(content) as AnalysisResult;

  if (
    !parsed.verdict ||
    !parsed.title ||
    !parsed.description ||
    !parsed.bettingIndex
  ) {
    throw new Error('OpenAI atsakyme trūksta privalomų laukų');
  }

  if (!['mess', 'clean', 'unclear'].includes(parsed.verdict)) {
    throw new Error(`Netinkamas verdict: ${parsed.verdict}`);
  }

  if (parsed.bettingIndex < 1 || parsed.bettingIndex > 10) {
    parsed.bettingIndex = Math.max(
      1,
      Math.min(10, Math.round(parsed.bettingIndex)),
    );
  }

  logger.info(
    { verdict: parsed.verdict, bettingIndex: parsed.bettingIndex },
    'Nuotraukos analizė baigta',
  );

  return parsed;
}
