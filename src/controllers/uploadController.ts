import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../lib/logger';

export function handleUpload(req: AuthenticatedRequest, res: Response): void {
  if (!req.file) {
    res.status(400).json({ error: 'Nuotrauka yra privaloma' });
    return;
  }

  const uploadId = crypto.randomUUID();

  logger.info(
    {
      uploadId,
      userId: req.user?.id,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
    'Nuotrauka sėkmingai įkelta',
  );

  res.status(201).json({ uploadId });
}
