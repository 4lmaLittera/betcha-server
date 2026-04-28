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
    logger.error(
      { err: memberError, groupId: group.id, userId },
      'Nepavyko pridėti kūrėjo kaip nario',
    );
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
    logger.error(
      { err: memberError, groupId: group.id, userId },
      'Nepavyko prisijungti prie grupės',
    );
    res.status(500).json({ error: 'Nepavyko prisijungti prie grupės' });
    return;
  }

  logger.info(
    { groupId: group.id, userId },
    'Vartotojas prisijungė prie grupės',
  );
  res.status(200).json({ groupId: group.id, name: group.name });
}

export async function handleGetMyGroups(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user!.id;

  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('role, groups(id, name, invite_code, created_by_id)')
    .eq('profile_id', userId);

  if (error) {
    logger.error({ err: error, userId }, 'Nepavyko gauti grupių sąrašo');
    res.status(500).json({ error: 'Nepavyko gauti grupių sąrašo' });
    return;
  }

  type GroupRow = {
    id: string;
    name: string;
    invite_code: string;
    created_by_id: string;
  };
  type MembershipWithGroup = { role: string; groups: GroupRow };
  const typedMemberships = memberships as unknown as MembershipWithGroup[];

  const groupIds = typedMemberships.map((m) => m.groups.id);

  const { data: counts, error: countError } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const memberCounts: Record<string, number> = {};
  if (!countError && counts) {
    for (const row of counts) {
      memberCounts[row.group_id] = (memberCounts[row.group_id] || 0) + 1;
    }
  }

  const groups = typedMemberships.map((m) => ({
    id: m.groups.id,
    name: m.groups.name,
    inviteCode: m.groups.invite_code,
    createdById: m.groups.created_by_id,
    role: m.role,
    memberCount: memberCounts[m.groups.id] || 0,
  }));

  res.status(200).json(groups);
}

export async function handleGetGroupStats(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id: groupId } = req.params;
  const userId = req.user!.id;

  if (!groupId) {
    res.status(400).json({ error: 'Trūksta grupės ID' });
    return;
  }

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (membershipError) {
    logger.error(
      { err: membershipError, groupId, userId },
      'Klaida tikrinant narystę',
    );
    res.status(500).json({ error: 'Nepavyko patikrinti narystės' });
    return;
  }

  if (!membership) {
    res.status(403).json({ error: 'Neturite prieigos prie šios grupės' });
    return;
  }

  const { data: openQuestRows, error: openError } = await supabase
    .from('quests')
    .select(
      'id, title, status, difficulty_score, created_at, assigned:profiles!quests_assigned_to_fkey(id, username)',
    )
    .eq('group_id', groupId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(5);

  if (openError) {
    logger.error({ err: openError, groupId }, 'Nepavyko gauti atvirų užduočių');
    res.status(500).json({ error: 'Nepavyko gauti grupės statistikos' });
    return;
  }

  const { data: resolvedQuestRows, error: resolvedError } = await supabase
    .from('quests')
    .select('id, title, status, completed_at')
    .eq('group_id', groupId)
    .in('status', ['completed', 'rejected'])
    .order('completed_at', { ascending: false })
    .limit(3);

  if (resolvedError) {
    logger.error(
      { err: resolvedError, groupId },
      'Nepavyko gauti užbaigtų užduočių',
    );
    res.status(500).json({ error: 'Nepavyko gauti grupės statistikos' });
    return;
  }

  const { count: openCount, error: countError } = await supabase
    .from('quests')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'open');

  if (countError) {
    logger.error(
      { err: countError, groupId },
      'Nepavyko suskaičiuoti atvirų užduočių',
    );
    res.status(500).json({ error: 'Nepavyko gauti grupės statistikos' });
    return;
  }

  type AssignedProfile = { id: string; username: string };
  type OpenQuestRow = {
    id: string;
    title: string;
    status: string;
    difficulty_score: number;
    created_at: string;
    assigned: AssignedProfile | AssignedProfile[] | null;
  };
  type ResolvedQuestRow = {
    id: string;
    title: string;
    status: string;
    completed_at: string | null;
  };
  type BetAmountRow = { amount: number | null };

  const typedOpenQuests = (openQuestRows ?? []) as unknown as OpenQuestRow[];
  const typedResolvedQuests = (resolvedQuestRows ??
    []) as unknown as ResolvedQuestRow[];

  const openIds = typedOpenQuests.map((q) => q.id);
  let totalPrizePool = 0;

  if (openIds.length > 0) {
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select('amount')
      .in('quest_id', openIds)
      .eq('status', 'pending');

    if (betsError) {
      logger.error({ err: betsError, groupId }, 'Nepavyko gauti lažybų sumos');
      res.status(500).json({ error: 'Nepavyko gauti grupės statistikos' });
      return;
    }

    totalPrizePool = ((bets ?? []) as BetAmountRow[]).reduce(
      (sum, b) => sum + (b.amount ?? 0),
      0,
    );
  }

  const openQuests = typedOpenQuests.map((q) => {
    const assigned = Array.isArray(q.assigned) ? q.assigned[0] : q.assigned;
    return {
      id: q.id,
      title: q.title,
      status: q.status,
      difficultyScore: q.difficulty_score,
      assignedTo: assigned
        ? { id: assigned.id, username: assigned.username }
        : null,
      createdAt: q.created_at,
    };
  });

  const recentResolved = typedResolvedQuests.map((q) => ({
    id: q.id,
    title: q.title,
    status: q.status,
    completedAt: q.completed_at,
  }));

  res.status(200).json({
    openQuests,
    openCount: openCount ?? 0,
    recentResolved,
    totalPrizePool,
  });
}

export async function handleGetGroupMembers(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id: groupId } = req.params;
  const userId = req.user!.id;

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('profile_id', userId)
    .single();

  if (membershipError || !membership) {
    res.status(403).json({ error: 'Neturite prieigos prie šios grupės' });
    return;
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    res.status(404).json({ error: 'Grupė nerasta' });
    return;
  }

  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('profile_id, role, joined_at, profiles(username, avatar_url)')
    .eq('group_id', groupId);

  if (membersError) {
    logger.error({ err: membersError, groupId }, 'Nepavyko gauti narių sąrašo');
    res.status(500).json({ error: 'Nepavyko gauti narių sąrašo' });
    return;
  }

  const result = {
    id: group.id,
    name: group.name,
    inviteCode: group.invite_code,
    members: (
      members as unknown as Array<{
        profile_id: string;
        role: string;
        joined_at: string;
        profiles: { username: string; avatar_url: string } | null;
      }>
    ).map((m) => ({
      profileId: m.profile_id,
      username: m.profiles?.username ?? null,
      avatarUrl: m.profiles?.avatar_url ?? null,
      role: m.role,
      joinedAt: m.joined_at,
    })),
  };

  res.status(200).json(result);
}
