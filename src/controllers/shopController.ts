import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

export const getStoreItems = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('store_items')
      .select('*')
      .order('price', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) {
    logger.error({ error }, 'Klaida gaunant parduotuvės prekes');
    return res.status(500).json({ error: 'Nepavyko užkrauti parduotuvės' });
  }
};

export const purchaseItem = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { itemId } = req.body;

  if (!userId || !itemId) {
    return res.status(400).json({ error: 'Trūksta duomenų pirkimui' });
  }

  try {
    // 1. Gauti prekę
    const { data: item, error: itemError } = await supabase
      .from('store_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ error: 'Prekė nerasta' });
    }

    // 2. Patikrinti balansą
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profilis nerastas' });
    }

    if (profile.balance < item.price) {
      return res.status(400).json({ error: 'Nepakanka balanso' });
    }

    // 3. Atlikti pirkimą (Supabase neturi transakcijų per JS SDK, todėl naudojame RPC arba eilės tvarka)
    // Kadangi tai svarbi operacija, geriausia būtų naudoti Postgres funkciją (RPC).
    // Bet kol kas įgyvendiname paprastą seką.
    
    // Nuskaitome balansą
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: profile.balance - item.price })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Pridedame į inventorių
    const { error: invError } = await supabase
      .from('user_inventory')
      .insert({ profile_id: userId, item_id: itemId });

    if (invError) throw invError;

    // Registruojame transakciją
    const { error: transError } = await supabase
      .from('transactions')
      .insert({
        profile_id: userId,
        amount: -item.price,
        type: 'purchase',
        reference_id: itemId
      });

    if (transError) throw transError;

    return res.status(200).json({ message: 'Pirkimas sėkmingas' });
  } catch (error) {
    logger.error({ error, userId, itemId }, 'Klaida pirkimo metu');
    return res.status(500).json({ error: 'Pirkimo klaida' });
  }
};
