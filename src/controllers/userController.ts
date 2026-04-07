import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Vartotojas neidentifikuotas' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, avatar_url, balance, total_points')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error({ error, userId }, 'Klaida gaunant vartotojo profilį');
      return res.status(404).json({ error: 'Profilis nerastas' });
    }

    return res.status(200).json(profile);
  } catch (err) {
    logger.error({ err, userId }, 'Serverio klaida gaunant profilį');
    return res.status(500).json({ error: 'Vidinė serverio klaida' });
  }
};
