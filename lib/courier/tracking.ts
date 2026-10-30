import { refreshDelhivery } from "./delhiveryWorkflow";
import { supabase } from "@/lib/supabase/client";
export async function courierTracking(orderRef: string, mobile: string) {
  if (
    !/^[A-Za-z0-9_-]{3,100}$/.test(orderRef) ||
    !/^\d{10,15}$/.test(mobile.replace(/\D/g, ""))
  )
    return null;
  const { data, error } = await supabase
    .from("courier_shipments")
    .select("*")
    .eq("order_ref", orderRef)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const expected = String(data.input?.points?.[1]?.contact_person?.phone || "")
    .replace(/\D/g, "")
    .slice(-10);
  if (expected !== mobile.replace(/\D/g, "").slice(-10)) return null;
  const latest =
    data.provider === "delhivery" ? await refreshDelhivery(data) : data;
  return {
    orderRef: data.order_ref,
    status: latest.delivery_status || latest.provider_status || latest.state,
    updatedAt: latest.updated_at,
  };
}
