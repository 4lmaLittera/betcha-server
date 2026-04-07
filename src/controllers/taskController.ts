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
