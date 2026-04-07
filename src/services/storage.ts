import { supabase } from '../lib/supabase';
import logger from '../lib/logger';

const BUCKET_NAME = 'photos';

export async function uploadToStorage(
  buffer: Buffer,
  mimeType: string,
  uploadId: string,
): Promise<string | null> {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const filePath = `uploads/${uploadId}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    logger.error({ err: error, uploadId }, 'Nepavyko įkelti nuotraukos į Storage');
    return null;
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  logger.info({ uploadId, url: data.publicUrl }, 'Nuotrauka įkelta į Storage');

  return data.publicUrl;
}
