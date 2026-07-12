import { supabase } from "./client";

export async function getActiveCouriers() {
  const { data, error } = await supabase
    .from("courier_master")
    .select("*")
    .eq("is_active", true)
    .order("courier_name");

  if (error) throw error;

  return data;
}
