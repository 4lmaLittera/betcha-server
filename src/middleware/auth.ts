import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Trūksta autorizacijos antraštės' });
    return;
  }

  const token = authHeader.split(' ')[1];

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    logger.warn({ error }, 'Nepavyko autentifikuoti vartotojo');
    res.status(401).json({ error: 'Neteisingas arba pasibaigęs tokenas' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
  };

  next();
}
