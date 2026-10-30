import { supabase } from "@/lib/supabase/client";
import { createHash } from "node:crypto";
import { CourierError, type BookingInput } from "./borzo";
export type Shipment = {
  id: string;
  order_ref: string;
  access_hash: string;
  customer_enabled: boolean;
  input: BookingInput;
  state: string;
  borzo_id: number | null;
  provider: "borzo" | "delhivery";
  revision: number;
  accepted_at: string | null;
  payment_confirmed_at: string | null;
  payment_reference: string | null;
  paid_amount: string | null;
  delhivery_awb: string | null;
  provider_checked_at: string | null;
  quote_checked_at: string | null;
  pickup_date: string | null;
  pickup_request_id: string | null;
  provider_status: string | null;
  delivery_status: string | null;
  amount: string | null;
  updated_at: string;
  provider_updated_at: string | null;
};
export const accessHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function shipment(
  id: string,
  access?: string,
  staff = false,
): Promise<Shipment> {
  if (!/^[a-f\d-]{36}$/i.test(id))
    throw new CourierError("Delivery not found.", 404);
  const { data, error } = await supabase
    .from("courier_shipments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new CourierError("Courier storage is unavailable.", 503);
  if (!data || (!staff && (!access || data.access_hash !== accessHash(access))))
    throw new CourierError("Delivery not found.", 404);
  return data;
}
export function publicShipment(s: Shipment) {
  return {
    id: s.id,
    provider: s.provider,
    revision: s.revision,
    accepted_at: s.accepted_at,
    payment_confirmed_at: s.payment_confirmed_at,
    awb: s.delhivery_awb,
    pickup_date: s.pickup_date,
    pickup_request_id: s.pickup_request_id,
    dispatch_enabled:
      s.provider === "delhivery" &&
      process.env.DELHIVERY_LIVE_ENABLED === "true",
    order_ref: s.order_ref,
    state: s.state,
    provider_status: s.provider_status,
    delivery_status: s.delivery_status,
    amount: s.amount,
    updated_at: s.updated_at,
    customer_enabled: s.customer_enabled,
    points: s.input.points.map((p) => ({
      address: p.address,
      name: p.contact_person.name,
      phone: p.contact_person.phone,
      pays: p.is_order_payment_here,
    })),
    test:
      s.provider === "delhivery"
        ? process.env.DELHIVERY_ENV === "staging"
        : process.env.BORZO_ENV !== "production",
  };
}
export async function saveShipment(id: string, patch: object) {
  const { error } = await supabase
    .from("courier_shipments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error)
    throw new CourierError(
      "Could not save delivery state. Do not repeat booking; ask staff to reconcile.",
      503,
    );
}
