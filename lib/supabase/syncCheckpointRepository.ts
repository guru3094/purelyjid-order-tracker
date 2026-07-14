import { supabase } from "@/lib/supabase/client";

export async function getSyncCheckpoint(
  checkpointName: string
) {
  const { data, error } = await supabase
    .from("sync_checkpoint")
    .select("*")
    .eq("checkpoint_name", checkpointName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSyncCheckpoint(
  checkpointName: string,
  timestamp: string
) {
  const { error } = await supabase
    .from("sync_checkpoint")
    .update({
      last_successful_sync: timestamp,
      updated_at: new Date().toISOString(),
    })
    .eq("checkpoint_name", checkpointName);

  if (error) {
    throw error;
  }
}
