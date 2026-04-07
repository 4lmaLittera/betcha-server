import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export function handleMulterError(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Failas per didelis. Maksimalus dydis: 10MB.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.message?.includes('Netinkamas failo tipas')) {
    res.status(415).json({ error: err.message });
    return;
  }

  next(err);
}
