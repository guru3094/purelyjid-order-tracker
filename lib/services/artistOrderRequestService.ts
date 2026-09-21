import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { appendArtistOrder } from "@/lib/google/artistSheet";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type ArtistDetailsInput = {
  requirements?: unknown;
  artistCost?: unknown;
  artistAdvance?: unknown;
  estimatedDeliveryDate?: unknown;
  comments?: unknown;
};

export async function saveArtistOrderRequest(args: {
  orderId: string; orderDate: string; customerName: string; productName: string; artistDetails?: ArtistDetailsInput;
}) {
  const details = args.artistDetails;
  if (!details) return;
  const artistCost = Number(details.artistCost ?? 0);
  const artistAdvance = Number(details.artistAdvance ?? 0);
  if (!Number.isFinite(artistCost) || artistCost < 0) throw new Error("Artist cost must be zero or greater.");
  if (!Number.isFinite(artistAdvance) || artistAdvance < 0 || artistAdvance > artistCost) throw new Error("Artist advance must be between ₹0 and artist cost.");
  const payload = {
    order_id: args.orderId,
    order_date: args.orderDate,
    customer_name: args.customerName,
    product_name: args.productName,
    requirements: String(details.requirements ?? "").trim(),
    artist_cost: artistCost,
    artist_advance: artistAdvance,
    artist_balance: artistCost - artistAdvance,
    estimated_delivery_date: String(details.estimatedDeliveryDate ?? "").trim(),
    comments: String(details.comments ?? "").trim(),
    artist_status: "NOT_SENT",
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("artist_order_requests").upsert(payload, { onConflict: "order_id" });
  if (error) throw new Error(`Could not save Artist details: ${error.message}`);
}

export async function createArtistAcceptanceLink(orderId: string) {
  const client = db();
  const { data: order, error } = await client.from("artist_order_requests").select("*").eq("order_id", orderId).single();
  if (error || !order) throw new Error("Artist details were not found for this order.");

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("artist_order_requests").update({
    acceptance_token_hash: tokenHash,
    acceptance_token_expires_at: expiresAt,
    artist_status: "SENT",
    whatsapp_sent_at: now,
    updated_at: now,
  }).eq("order_id", orderId);
  if (updateError) throw new Error(`Could not prepare Artist acceptance link: ${updateError.message}`);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://purelyjid.in").replace(/\/$/, "");
  return { order, acceptanceUrl: `${appUrl}/artist/respond/${token}`, expiresAt };
}

export async function getArtistRequestByToken(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const { data, error } = await db().from("artist_order_requests").select("*").eq("acceptance_token_hash", hashToken(token)).maybeSingle();
  if (error || !data) return null;
  if (!data.acceptance_token_expires_at || new Date(data.acceptance_token_expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function acceptArtistRequest(token: string) {
  const client = db();
  const tokenHash = hashToken(token);
  const order = await getArtistRequestByToken(token);
  if (!order) throw new Error("This acceptance link is invalid or has expired.");
  if (order.artist_sheet_updated) return { order, duplicate: true };

  // Claim this one-time token before the Sheet write. Only one request can claim it.
  const { data: claimed, error: claimError } = await client
    .from("artist_order_requests")
    .update({ acceptance_token_hash: null, acceptance_token_expires_at: null, updated_at: new Date().toISOString() })
    .eq("order_id", order.order_id)
    .eq("acceptance_token_hash", tokenHash)
    .select("order_id")
    .maybeSingle();

  if (claimError) throw new Error(`Could not validate acceptance: ${claimError.message}`);
  if (!claimed) {
    const { data: latest } = await client.from("artist_order_requests").select("*").eq("order_id", order.order_id).single();
    if (latest?.artist_sheet_updated) return { order: latest, duplicate: true };
    throw new Error("This acceptance link has already been used.");
  }

  try {
    await appendArtistOrder(order);
  } catch (error) {
    // Restore the token so the artist can retry if Google Sheets was temporarily unavailable.
    await client.from("artist_order_requests").update({
      acceptance_token_hash: tokenHash,
      acceptance_token_expires_at: order.acceptance_token_expires_at,
      updated_at: new Date().toISOString(),
    }).eq("order_id", order.order_id).is("acceptance_token_hash", null);
    throw error;
  }

  const now = new Date().toISOString();
  const { error } = await client.from("artist_order_requests").update({
    artist_status: "ACCEPTED",
    accepted_at: now,
    artist_sheet_updated: true,
    artist_sheet_updated_at: now,
    updated_at: now,
  }).eq("order_id", order.order_id);
  if (error) throw new Error(`Artist Sheet was updated but acceptance status could not be saved: ${error.message}`);
  return { order, duplicate: false };
}
