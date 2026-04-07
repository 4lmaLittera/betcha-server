import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

interface CreateTaskBody {
  title: string;
  description: string;
  bettingIndex: number;
  groupId: string;
}

export async function handleCreateTask(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { title, description, bettingIndex, groupId } = req.body as CreateTaskBody;

  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Pavadinimas yra privalomas' });
    return;
  }

  if (!description || !description.trim()) {
    res.status(400).json({ error: 'Aprašymas yra privalomas' });
    return;
  }

  if (!bettingIndex || bettingIndex < 1 || bettingIndex > 10) {
    res.status(400).json({ error: 'Lazybų indeksas turi būti nuo 1 iki 10' });
    return;
  }

  if (!groupId) {
    res.status(400).json({ error: 'Grupės ID yra privalomas' });
    return;
  }

  const { data, error } = await supabase
    .from('quests')
    .insert({
      title: title.trim(),
      description: description.trim(),
      difficulty_score: bettingIndex,
      group_id: groupId,
      creator_id: req.user!.id,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ err: error }, 'Nepavyko sukurti užduoties');
    res.status(500).json({ error: 'Nepavyko sukurti užduoties' });
    return;
  }

  logger.info({ taskId: data.id, userId: req.user!.id }, 'Užduotis sukurta');

  res.status(201).json({ id: data.id });
}

interface ResolveTaskBody {
  resolution_is_positive: boolean;
}

export async function handleResolveTask(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { taskId } = req.params;
  const { resolution_is_positive } = req.body as ResolveTaskBody;

  if (!taskId) {
    res.status(400).json({ error: 'Trūksta taskId parametro' });
    return;
  }

  if (typeof resolution_is_positive !== 'boolean') {
    res.status(400).json({ error: 'resolution_is_positive turi būti boolean reikšmė' });
    return;
  }

  try {
    const { data, error } = await supabase.rpc('resolve_quest', {
      p_quest_id: taskId,
      p_resolution_is_positive: resolution_is_positive,
    });

    if (error) {
      if (error.message.includes('Užduotis nerasta')) {
        logger.warn({ taskId }, 'Bandyta išspręsti nerastą užduotį');
        res.status(404).json({ error: 'Užduotis nerasta' });
        return;
      }
      if (error.message.includes('Užduotis jau yra uždaryta')) {
        logger.warn({ taskId }, 'Bandyta išspręsti jau uždarytą užduotį');
        res.status(400).json({ error: 'Lažybos šiai užduočiai jau uždarytos' });
        return;
      }

      logger.error({ err: error, taskId }, 'Klaida perskirstant taškus');
      res.status(500).json({ error: 'Nepavyko perskirstyti lažybų taškų' });
      return;
    }

    logger.info({ taskId, resolution: resolution_is_positive }, 'Užduotis sėkmingai išspręsta ir taškai perskirstyti');
    res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nežinoma klaida';
    logger.error({ err, taskId }, 'Netikėta klaida uždarant lažybas');
    res.status(500).json({ error: 'Vidinė serverio klaida', details: message });
  }
}
