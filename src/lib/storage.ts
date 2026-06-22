import { supabase } from "@/integrations/supabase/client";

const BUCKET = "attachments";

export async function uploadAttachment(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getAttachmentUrl(path: string, expiresIn = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
