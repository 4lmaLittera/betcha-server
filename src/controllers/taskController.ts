import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

interface CreateTaskBody {
  title: string;
  description: string;
  bettingIndex: number;
  groupId: string;
  photoUrl?: string;
}

export async function handleCreateTask(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { title, description, bettingIndex, groupId, photoUrl } = req.body as CreateTaskBody;

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

  const creatorId = req.user!.id;

  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('profile_id')
    .eq('group_id', groupId);

  if (membersError) {
    logger.error({ err: membersError, groupId }, 'Nepavyko gauti grupės narių');
    res.status(500).json({ error: 'Nepavyko gauti grupės narių' });
    return;
  }

  const candidates = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id) => id !== creatorId);

  const assignedTo =
    candidates.length === 0
      ? creatorId
      : candidates[Math.floor(Math.random() * candidates.length)];

  const { data, error } = await supabase
    .from('quests')
    .insert({
      title: title.trim(),
      description: description.trim(),
      difficulty_score: bettingIndex,
      group_id: groupId,
      creator_id: creatorId,
      assigned_to: assignedTo,
      status: 'open',
      initial_image_url: photoUrl?.trim() || null,
    })
    .select('id, assigned_to, initial_image_url')
    .single();

  if (error) {
    logger.error({ err: error }, 'Nepavyko sukurti užduoties');
    res.status(500).json({ error: 'Nepavyko sukurti užduoties' });
    return;
  }

  logger.info(
    { taskId: data.id, userId: creatorId, assignedTo: data.assigned_to },
    'Užduotis sukurta',
  );

  res.status(201).json({
    id: data.id,
    assignedTo: data.assigned_to,
    initialImageUrl: data.initial_image_url,
  });
}

export async function handleGetTaskById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { taskId } = req.params;

  if (!taskId) {
    res.status(400).json({ error: 'Trūksta taskId parametro' });
    return;
  }

  const { data: quest, error: questError } = await supabase
    .from('quests')
    .select(`
      id,
      group_id,
      title,
      description,
      status,
      difficulty_score,
      ai_verdict_reason,
      initial_image_url,
      evidence_image_url,
      created_at,
      completed_at,
      creator:profiles!quests_creator_id_fkey (
        id,
        username,
        avatar_url
      ),
      assigned:profiles!quests_assigned_to_fkey (
        id,
        username,
        avatar_url
      )
    `)
    .eq('id', taskId)
    .maybeSingle();

  if (questError) {
    logger.error({ err: questError, taskId }, 'Klaida gaunant užduotį');
    res.status(500).json({ error: 'Nepavyko gauti užduoties' });
    return;
  }

  if (!quest) {
    res.status(404).json({ error: 'Užduotis nerasta' });
    return;
  }

  const { data: bets, error: betsError } = await supabase
    .from('bets')
    .select('amount, prediction_is_positive')
    .eq('quest_id', taskId);

  if (betsError) {
    logger.error({ err: betsError, taskId }, 'Klaida gaunant lažybų agregaciją');
    res.status(500).json({ error: 'Nepavyko gauti lažybų duomenų' });
    return;
  }

  let totalPool = 0;
  let forCount = 0;
  let againstCount = 0;

  bets?.forEach((bet) => {
    totalPool += bet.amount;
    if (bet.prediction_is_positive) {
      forCount += 1;
    } else {
      againstCount += 1;
    }
  });

  const creator = Array.isArray(quest.creator) ? quest.creator[0] : quest.creator;
  const assigned = Array.isArray(quest.assigned) ? quest.assigned[0] : quest.assigned;

  res.status(200).json({
    id: quest.id,
    groupId: quest.group_id,
    title: quest.title,
    description: quest.description,
    status: quest.status,
    difficultyScore: quest.difficulty_score,
    aiVerdictReason: quest.ai_verdict_reason,
    initialImageUrl: quest.initial_image_url,
    evidenceImageUrl: quest.evidence_image_url,
    createdAt: quest.created_at,
    completedAt: quest.completed_at,
    creator: creator ?? null,
    assignedTo: assigned ?? null,
    bets: {
      totalPool,
      forCount,
      againstCount,
    },
  });
}

interface AssignTaskBody {
  assignedTo: string;
}

export async function handleAssignTask(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { taskId } = req.params;
  const { assignedTo } = req.body as AssignTaskBody;
  const userId = req.user!.id;

  if (!taskId) {
    res.status(400).json({ error: 'Trūksta taskId parametro' });
    return;
  }

  if (!assignedTo || typeof assignedTo !== 'string' || !assignedTo.trim()) {
    res.status(400).json({ error: 'assignedTo yra privalomas' });
    return;
  }

  const { data: quest, error: questError } = await supabase
    .from('quests')
    .select('id, group_id, creator_id, status')
    .eq('id', taskId)
    .maybeSingle();

  if (questError) {
    logger.error({ err: questError, taskId }, 'Klaida gaunant užduotį priskyrimui');
    res.status(500).json({ error: 'Nepavyko gauti užduoties' });
    return;
  }

  if (!quest) {
    res.status(404).json({ error: 'Užduotis nerasta' });
    return;
  }

  if (quest.status !== 'open') {
    res.status(400).json({ error: 'Galima priskirti tik atviras užduotis' });
    return;
  }

  const isCreator = quest.creator_id === userId;

  if (!isCreator) {
    const { data: requesterMembership, error: requesterError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', quest.group_id)
      .eq('profile_id', userId)
      .maybeSingle();

    if (requesterError) {
      logger.error({ err: requesterError, taskId, userId }, 'Klaida tikrinant narystę');
      res.status(500).json({ error: 'Nepavyko patikrinti narystės' });
      return;
    }

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      res.status(403).json({ error: 'Neturite teisės priskirti šios užduoties' });
      return;
    }
  }

  const { data: assigneeMembership, error: assigneeError } = await supabase
    .from('group_members')
    .select('profile_id')
    .eq('group_id', quest.group_id)
    .eq('profile_id', assignedTo)
    .maybeSingle();

  if (assigneeError) {
    logger.error({ err: assigneeError, taskId, assignedTo }, 'Klaida tikrinant priskyriamą narį');
    res.status(500).json({ error: 'Nepavyko patikrinti priskyriamo nario' });
    return;
  }

  if (!assigneeMembership) {
    res.status(400).json({ error: 'Priskiriamas vartotojas nėra šios grupės narys' });
    return;
  }

  const { error: updateError } = await supabase
    .from('quests')
    .update({ assigned_to: assignedTo })
    .eq('id', taskId);

  if (updateError) {
    logger.error({ err: updateError, taskId, assignedTo }, 'Nepavyko priskirti užduoties');
    res.status(500).json({ error: 'Nepavyko priskirti užduoties' });
    return;
  }

  logger.info({ taskId, assignedTo, userId }, 'Užduotis priskirta nariui');
  res.status(200).json({ id: taskId, assignedTo });
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
