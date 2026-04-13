import crypto from 'crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

interface CreateGroupBody {
  name: string;
}

export async function handleCreateGroup(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { name } = req.body as CreateGroupBody;

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Grupės pavadinimas yra privalomas' });
    return;
  }

  const inviteCode = generateInviteCode();
  const userId = req.user!.id;

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name: name.trim(),
      invite_code: inviteCode,
      created_by_id: userId,
    })
    .select('id, name, invite_code')
    .single();

  if (groupError) {
    logger.error({ err: groupError, userId }, 'Nepavyko sukurti grupės');
    res.status(500).json({ error: 'Nepavyko sukurti grupės' });
    return;
  }

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    profile_id: userId,
    role: 'admin',
  });

  if (memberError) {
    logger.error({ err: memberError, groupId: group.id, userId }, 'Nepavyko pridėti kūrėjo kaip nario');
    res.status(500).json({ error: 'Nepavyko pridėti kūrėjo kaip nario' });
    return;
  }

  logger.info({ groupId: group.id, userId }, 'Grupė sukurta');
  res.status(201).json(group);
}

interface JoinGroupBody {
  inviteCode: string;
}

export async function handleJoinGroup(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { inviteCode } = req.body as JoinGroupBody;

  if (!inviteCode || !inviteCode.trim()) {
    res.status(400).json({ error: 'Kvietimo kodas yra privalomas' });
    return;
  }

  const userId = req.user!.id;

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .single();

  if (groupError || !group) {
    res.status(404).json({ error: 'Grupė su tokiu kvietimo kodu nerasta' });
    return;
  }

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    profile_id: userId,
    role: 'member',
  });

  if (memberError) {
    if (memberError.code === '23505') {
      res.status(409).json({ error: 'Jau esate šios grupės narys' });
      return;
    }
    logger.error({ err: memberError, groupId: group.id, userId }, 'Nepavyko prisijungti prie grupės');
    res.status(500).json({ error: 'Nepavyko prisijungti prie grupės' });
    return;
  }

  logger.info({ groupId: group.id, userId }, 'Vartotojas prisijungė prie grupės');
  res.status(200).json({ groupId: group.id, name: group.name });
}
