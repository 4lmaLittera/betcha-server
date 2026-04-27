import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

export const getInventory = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Neidentifikuotas' });

  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select(
        `
        id,
        is_used,
        purchased_at,
        item:store_items (
          id,
          name,
          description
        )
      `,
      )
      .eq('profile_id', userId)
      .eq('is_used', false)
      .order('purchased_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) {
    logger.error({ error, userId }, 'Klaida gaunant inventorių');
    return res.status(500).json({ error: 'Nepavyko užkrauti inventoriaus' });
  }
};

export const useItem = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { inventoryId } = req.body;

  if (!userId || !inventoryId) {
    return res.status(400).json({ error: 'Trūksta duomenų naudojimui' });
  }

  try {
    const { error } = await supabase
      .from('user_inventory')
      .update({ is_used: true })
      .eq('id', inventoryId)
      .eq('profile_id', userId);

    if (error) throw error;
    return res.status(200).json({ message: 'Prekė sėkmingai panaudota' });
  } catch (error) {
    logger.error({ error, userId, inventoryId }, 'Klaida naudojant prekę');
    return res.status(500).json({ error: 'Klaida naudojant prekę' });
  }
};
