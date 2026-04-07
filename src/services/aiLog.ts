import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

interface AiLogEntry {
  uploadId: string;
  status: 'success' | 'failed';
  errorReason?: string;
}

export async function logAiRequest(entry: AiLogEntry): Promise<void> {
  const { error } = await supabase.from('ai_logs').insert({
    upload_id: entry.uploadId,
    status: entry.status,
    error_reason: entry.errorReason ?? null,
  });

  if (error) {
    logger.error({ err: error, uploadId: entry.uploadId }, 'Nepavyko įrašyti ai_log');
  }
}
