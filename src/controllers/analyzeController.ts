import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import { analyzePhoto } from '../services/analyzePhoto';
import { logAiRequest } from '../services/aiLog';
import { uploadToStorage } from '../services/storage';
import logger from '../lib/logger';

export async function handleAnalyze(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Nuotrauka yra privaloma' });
    return;
  }

  const uploadId = crypto.randomUUID();

  try {
    const result = await analyzePhoto(req.file.buffer, req.file.mimetype);

    const photoUrl = await uploadToStorage(
      req.file.buffer,
      req.file.mimetype,
      uploadId,
    );

    await logAiRequest({ uploadId, status: 'success' });

    logger.info(
      { uploadId, userId: req.user?.id, verdict: result.verdict, photoUrl },
      'Nuotraukos analizė sėkminga',
    );

    res.status(200).json({ uploadId, ...result, photoUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nežinoma klaida';
    const isTimeout = message === 'AI_TIMEOUT';

    await logAiRequest({
      uploadId,
      status: 'failed',
      errorReason: isTimeout ? 'timeout' : message,
    });

    logger.error({ uploadId, err, isTimeout }, 'DI analizės klaida');

    if (isTimeout) {
      res.status(408).json({
        error: 'AI_TIMEOUT',
        message:
          'DI analizė užtruko per ilgai. Galite suvesti duomenis rankiniu būdu.',
        uploadId,
      });
      return;
    }

    res.status(422).json({
      error: 'AI_UNRECOGNIZED',
      message: 'Nepavyko atpažinti nuotraukos turinio',
      details: message,
      uploadId,
    });
  }
}
