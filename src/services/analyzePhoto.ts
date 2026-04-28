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
- "bettingIndex": sveikas skaičius nuo 1 iki 10, vertinantis užduoties sudėtingumą pagal laiką, fizines pastangas ir nemalonumą. NAUDOK PILNĄ SKALĘ — nesiek "saugaus" vidurio 3–5; jei užduotis trumpa, drąsiai rink 1–2; jei labai didelė, 8–10. Skalė:
  • 1 = <1 min, vienas paprastas veiksmas (pakelti vieną daiktą, padėti puodelį į kriauklę)
  • 2 = 1–3 min, kelių daiktų sutvarkymas (sutvarkyti rašymo stalą, sulankstyti pledą)
  • 3 = 3–5 min, vienas paprastas segmentas (pašluostyti stalą, pakloti lovą)
  • 4 = 5–10 min, kelių darbų derinys (sudėti drabužius į vietą, sutvarkyti lentyną)
  • 5 = ~15 min, vidutinis darbas (išplauti dienos indus, išsiurbti vieną kambarį)
  • 6 = 20–30 min, kelių darbų visas kambarys (sutvarkyti virtuvę po vakarienės)
  • 7 = 30–45 min, didelis vienkartinis darbas (išvalyti šaldytuvą, išplauti langus)
  • 8 = ~1 val., vieno kambario generalinis (vonios kambario gilus valymas)
  • 9 = 1–2 val., kelių patalpų valymas (svetainė + virtuvė + koridorius)
  • 10 = 2+ val., viso namo generalinis (visos patalpos, baldų stūmimas)
Jei verdict yra "clean" arba "unclear", bettingIndex turi būti 1.

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
