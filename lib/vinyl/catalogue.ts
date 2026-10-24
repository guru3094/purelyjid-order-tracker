import { createClient } from "@supabase/supabase-js";
import type { CatalogueDesign, CutOutline } from "./catalogue-types";
export function catalogueDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Catalogue storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export type CatalogueRecord = { id: string; code: string; name: string; category: string; published: boolean; outline: CutOutline; thumbnail: string | null; updated_at: string };
export const metadataColumns = "id,code,name,category,published,width,height,updated_at";
export function publicMetadata(row: Record<string, unknown>): CatalogueDesign {
  return { id: String(row.id), code: String(row.code), name: String(row.name), category: String(row.category), published: Boolean(row.published), width: Number(row.width), height: Number(row.height), revision: String(row.updated_at) };
}
export async function catalogueRecord(id: string, staff = false) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let query = catalogueDb().from("vinyl_designs").select("*").eq("id", id);
  if (!staff) query = query.eq("published", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as CatalogueRecord | null;
}
