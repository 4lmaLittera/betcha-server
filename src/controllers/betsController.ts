import { Response } from 'express';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';
import { AuthenticatedRequest } from '../middleware/auth';

interface PlaceBetBody {
  questId: string;
  direction: 'for' | 'against';
  amount: number;
  coefficient: number;
}

export async function placeBet(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Vartotojas neautentifikuotas' });
    return;
  }

  const { questId, direction, amount, coefficient } = req.body as PlaceBetBody;

  // Įvesties validacija
  if (!questId || !direction || !amount || !coefficient) {
    res.status(400).json({ error: 'Trūksta privalomų laukų: questId, direction, amount, coefficient' });
    return;
  }

  if (direction !== 'for' && direction !== 'against') {
    res.status(400).json({ error: 'direction turi būti "for" arba "against"' });
    return;
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount turi būti teigiamas sveikasis skaičius' });
    return;
  }

  try {
    // Atominis statymas per Postgres funkciją (patikrina balansą + sukuria lažybą)
    const { data, error } = await supabase.rpc('place_bet', {
      p_profile_id:  userId,
      p_quest_id:    questId,
      p_amount:      amount,
      p_direction:   direction === 'for',
      p_coefficient: coefficient,
    });

    if (error) {
      // Supabase perduoda Postgres klaidas per error.message
      if (error.message.includes('Nepakanka taškų')) {
        logger.warn({ userId, amount }, 'Nepakanka taškų statymui');
        res.status(400).json({ error: 'Nepakanka taškų' });
        return;
      }

      if (error.message.includes('Vartotojas nerastas')) {
        logger.warn({ userId }, 'Profilis nerastas');
        res.status(404).json({ error: 'Vartotojo profilis nerastas' });
        return;
      }

      logger.error({ err: error, userId }, 'Klaida kuriant statymą');
      res.status(500).json({ error: 'Vidinė serverio klaida' });
      return;
    }

    logger.info({ userId, questId, amount, direction }, 'Statymas sėkmingai sukurtas');
    res.status(200).json({ bet: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nežinoma klaida';
    logger.error({ err, userId }, 'Netikėta klaida kuriant statymą');
    res.status(500).json({ error: 'Vidinė serverio klaida', details: message });
  }
}

export async function getQuestBets(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { questId } = req.params;

  if (!questId) {
    res.status(400).json({ error: 'Trūksta questId parametro' });
    return;
  }

  try {
    const { data: bets, error } = await supabase
      .from('bets')
      .select(`
        id,
        amount,
        prediction_is_positive,
        created_at,
        profiles (
          id,
          username,
          avatar_url
        )
      `)
      .eq('quest_id', questId);

    if (error) {
      logger.error({ err: error, questId }, 'Klaida gaunant lažybų sąrašą');
      res.status(500).json({ error: 'Neuždelsiant nepavyko gauti duomenų' });
      return;
    }

    let totalPool = 0;
    const forBets: any[] = [];
    const againstBets: any[] = [];

    bets?.forEach((bet) => {
      totalPool += bet.amount;

      const betInfo = {
        id: bet.id,
        amount: bet.amount,
        createdAt: bet.created_at,
        profile: Array.isArray(bet.profiles) ? bet.profiles[0] : bet.profiles,
      };

      if (bet.prediction_is_positive) {
        forBets.push(betInfo);
      } else {
        againstBets.push(betInfo);
      }
    });

    res.status(200).json({
      totalPool,
      forBets,
      againstBets,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nežinoma klaida';
    logger.error({ err, questId }, 'Netikėta klaida gaunant lažybų sąrašą');
    res.status(500).json({ error: 'Vidinė serverio klaida', details: message });
  }
}
