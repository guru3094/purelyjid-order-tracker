import { NextRequest, NextResponse } from "next/server";
import { validSignature } from "@/lib/courier/borzo";
import { supabase } from "@/lib/supabase/client";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = process.env.BORZO_CALLBACK_SECRET;
  if (raw.length > 200000)
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  if (
    !secret ||
    !validSignature(raw, request.headers.get("x-dv-signature") || "", secret)
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  try {
    const e = JSON.parse(raw);
    if (
      e.event_type === "delivery_changed" ||
      e.event_type === "delivery_created"
    ) {
      const d = e.delivery;
      const at = Date.parse(d?.status_datetime || e.event_datetime);
      if (
        !d ||
        !Number.isInteger(d.order_id) ||
        !Number.isFinite(at) ||
        typeof d.status !== "string"
      )
        return NextResponse.json(
          { error: "Invalid delivery event" },
          { status: 400 },
        );
      const { data, error } = await supabase.rpc("apply_borzo_delivery_event", {
        provider_id: d.order_id,
        event_at: new Date(at).toISOString(),
        new_status: d.status,
        client_reference: d.client_order_id || "",
      });
      return error || data !== true
        ? NextResponse.json({ error: "Retry later" }, { status: 503 })
        : NextResponse.json({ ok: true });
    }
    const o = e.order;
    const at = Date.parse(e.event_datetime);
    if (!o || !Number.isInteger(o.order_id) || !Number.isFinite(at))
      return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
    const { data, error } = await supabase.rpc("apply_borzo_event", {
      provider_id: o.order_id,
      event_at: new Date(at).toISOString(),
      new_status: String(o.status || ""),
      new_delivery_status: o.points?.at(-1)?.delivery?.status || null,
      client_reference:
        o.points?.find((p: { client_order_id?: string }) => p.client_order_id)
          ?.client_order_id || "",
    });
    if (error || data !== true)
      return NextResponse.json({ error: "Retry later" }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
}
