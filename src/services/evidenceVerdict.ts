import { getOpenAI } from '../lib/openai';
import logger from '../lib/logger';

export type EvidenceVerdict = {
  verdict: 'approved' | 'rejected' | 'unclear';
  reason: string;
};

export interface EvidenceVerdictInput {
  initialImageUrl: string;
  evidenceImageUrl: string;
  taskTitle: string;
  taskDescription: string;
}

const SYSTEM_PROMPT = `Tu esi namų ruošos užduočių vertintojas. Gauni dvi nuotraukas (PRIEŠ ir PO) bei užduoties aprašymą. Turi nuspręsti, ar užduotis tikrai atlikta.

Vertinimo principai:
- Lygink būsenos pokytį tarp PRIEŠ ir PO nuotraukų KONKREČIOS užduoties kontekste.
- Užduotis atlikta jei matomas aiškus pagerėjimas, atitinkantis užduoties aprašymą (pvz., kriauklėje nebėra nešvarių indų; drabužiai surinkti nuo grindų).
- Užduotis NEATLIKTA jei būsena nepasikeitė, pasikeitė nereikšmingai, arba PO nuotrauka rodo kitą vietą/objektą.
- Jei nuotraukos neaiškios, per tamsios, neatpažįstamos arba neįmanoma palyginti — verdict = "unclear".

Atsakyk JSON formatu su laukais:
- "verdict": "approved" jei užduotis atlikta, "rejected" jei neatlikta, "unclear" jei neįmanoma nustatyti.
- "reason": 1-2 sakiniai lietuvių kalba paaiškinantys sprendimą. Jei "rejected" — konkrečiai kas trūksta. Jei "approved" — kas pagerėjo.

Atsakyk TIK JSON objektu, be jokio papildomo teksto.`;

export async function evaluateEvidence(
  input: EvidenceVerdictInput,
): Promise<EvidenceVerdict> {
  const { initialImageUrl, evidenceImageUrl, taskTitle, taskDescription } =
    input;

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
                type: 'text',
                text: `Užduotis: ${taskTitle}\nAprašymas: ${taskDescription}\n\nPirmoji nuotrauka — PRIEŠ. Antroji — PO.`,
              },
              {
                type: 'image_url',
                image_url: { url: initialImageUrl, detail: 'low' },
              },
              {
                type: 'image_url',
                image_url: { url: evidenceImageUrl, detail: 'low' },
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

  const parsed = JSON.parse(content) as EvidenceVerdict;

  if (!parsed.verdict || !parsed.reason) {
    throw new Error('OpenAI atsakyme trūksta privalomų laukų');
  }

  if (!['approved', 'rejected', 'unclear'].includes(parsed.verdict)) {
    throw new Error(`Netinkamas verdict: ${parsed.verdict}`);
  }

  logger.info(
    { verdict: parsed.verdict },
    'Įrodymo nuotraukos verdict baigtas',
  );

  return parsed;
}
