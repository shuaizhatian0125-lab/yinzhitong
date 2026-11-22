import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export type FileObjectRecord = {
  id: string;
  tenantId: string;
  bucket: string;
  objectKey: string;
  filename: string;
  mime: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  ownerId: string | null;
  sensitivity: string;
  createdAt: string;
};

export type UploadFileInput = {
  tenantId: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  content: Buffer | ArrayBuffer;
  ownerId?: string;
  sensitivity?: string;
  bucket?: string;
};

const DEFAULT_BUCKET = 'attachments';

function mapRow(row: Record<string, unknown>): FileObjectRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    bucket: row.bucket as string,
    objectKey: row.object_key as string,
    filename: row.filename as string,
    mime: (row.mime as string) ?? null,
    sizeBytes: (row.size_bytes as number) ?? null,
    checksum: (row.checksum as string) ?? null,
    ownerId: (row.owner_id as string) ?? null,
    sensitivity: (row.sensitivity as string) ?? 'internal',
    createdAt: row.created_at as string,
  };
}

function computeChecksum(content: Buffer | ArrayBuffer): string {
  const buf = content instanceof Buffer ? content : Buffer.from(new Uint8Array(content));
  return createHash('sha256').update(buf).digest('hex');
}

export async function uploadFile(input: UploadFileInput): Promise<FileObjectRecord> {
  const db = await getSupabaseClient();
  const bucket = input.bucket ?? DEFAULT_BUCKET;
  const id = randomUUID();
  const objectKey = `${input.tenantId}/${id}/${input.filename}`;
  const checksum = computeChecksum(input.content);

  const { error: storageError } = await db.storage
    .from(bucket)
    .upload(objectKey, input.content, {
      contentType: input.mime,
      upsert: false,
    });

  if (storageError) {
    throw new Error(`Failed to upload file to storage: ${storageError.message}`);
  }

  const { data, error: dbError } = await db
    .from('file_object')
    .insert({
      id,
      tenant_id: input.tenantId,
      bucket,
      object_key: objectKey,
      filename: input.filename,
      mime: input.mime,
      size_bytes: input.sizeBytes,
      checksum,
      owner_id: input.ownerId ?? null,
      sensitivity: input.sensitivity ?? 'internal',
    })
    .select('*')
    .limit(1);

  if (dbError || !data || data.length === 0) {
    await db.storage.from(bucket).remove([objectKey]);
    throw new Error(`Failed to create file_object record: ${dbError?.message ?? 'unknown error'}`);
  }

  return mapRow(data[0]);
}

export async function getPresignedUrl(
  fileId: string,
  tenantId: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const db = await getSupabaseClient();
  const { data: fileData } = await db
    .from('file_object')
    .select('bucket,object_key')
    .eq('id', fileId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!fileData || fileData.length === 0) return null;

  const { bucket, object_key: objectKey } = fileData[0] as { bucket: string; object_key: string };

  const { data } = await db.storage
    .from(bucket)
    .createSignedUrl(objectKey, expiresInSec);

  return data?.signedUrl ?? null;
}

export async function getFileMetadata(
  fileId: string,
  tenantId: string,
): Promise<FileObjectRecord | null> {
  const db = await getSupabaseClient();
  const { data } = await db
    .from('file_object')
    .select('*')
    .eq('id', fileId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!data || data.length === 0) return null;
  return mapRow(data[0]);
}

export async function deleteFile(
  fileId: string,
  tenantId: string,
): Promise<boolean> {
  const db = await getSupabaseClient();
  const { data: fileData } = await db
    .from('file_object')
    .select('bucket,object_key')
    .eq('id', fileId)
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!fileData || fileData.length === 0) return false;

  const { bucket, object_key: objectKey } = fileData[0] as { bucket: string; object_key: string };

  await db.storage.from(bucket).remove([objectKey]);
  await db.from('file_object').delete().eq('id', fileId).eq('tenant_id', tenantId);

  return true;
}