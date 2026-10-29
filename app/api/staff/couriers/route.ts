import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { supabase } from "@/lib/supabase/client";
import { readOrdersSheet } from "@/lib/google/sheets";
import { accessHash, shipment } from "@/lib/courier/repository";
import { CourierError, validateBooking } from "@/lib/courier/borzo";
export async function GET(request: NextRequest) {
  if (!(await isStaffAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    try {
      const s = await shipment(id, undefined, true);
      return NextResponse.json(
        {
          id: s.id,
          orderRef: s.order_ref,
          input: s.input,
          customerEnabled: s.customer_enabled,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Delivery not found" },
        { status: 404 },
      );
    }
  }
  const { data, error } = await supabase
    .from("courier_shipments")
    .select(
      "id,order_ref,state,provider_status,delivery_status,amount,updated_at,borzo_id,customer_enabled",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  return error
    ? NextResponse.json(
        { error: "Courier storage unavailable." },
        { status: 503 },
      )
    : NextResponse.json(
        { shipments: data },
        { headers: { "Cache-Control": "no-store" } },
      );
}
export async function POST(request: NextRequest) {
  if (!(await isStaffAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (
      request.headers.get("origin") !==
      (process.env.APP_ORIGIN || "https://www.purelyjid.in")
    )
      throw new CourierError("Invalid origin.", 403);
    const raw = await request.text();
    if (raw.length > 12000) throw new CourierError("Request too large.");
    const b = JSON.parse(raw);
    const input = validateBooking(b.input);
    let ref = String(b.orderRef || "").trim();
    const existing = b.id ? await shipment(b.id, undefined, true) : null;
    if (existing) {
      if (existing.state !== "draft")
        throw new CourierError("Only an unsubmitted draft can be edited.", 409);
      if (ref && ref !== existing.order_ref)
        throw new CourierError("Order reference cannot be changed.");
      ref = existing.order_ref;
    } else if (ref) {
      const rows = await readOrdersSheet();
      if (!rows.slice(1).some((r) => r[0] === ref))
        throw new CourierError(
          "Order reference not found in the Orders Sheet.",
        );
    } else ref = "PJC" + randomBytes(6).toString("hex").toUpperCase();
    const access = randomBytes(32).toString("base64url");
    if (existing) {
      const { data, error } = await supabase
        .from("courier_shipments")
        .update({
          input,
          access_hash: accessHash(access),
          customer_enabled: b.customerEnabled === true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("state", "draft")
        .select("id");
      if (error || !data?.length)
        throw new CourierError("Draft changed. Reload before editing.", 409);
      return NextResponse.json({
        id: existing.id,
        orderRef: ref,
        link: "/track-order#delivery=" + existing.id + "." + access,
      });
    }
    const { data, error } = await supabase
      .from("courier_shipments")
      .insert({
        order_ref: ref,
        access_hash: accessHash(access),
        input,
        customer_enabled: b.customerEnabled === true,
      })
      .select("id")
      .single();
    if (error)
      throw new CourierError(
        "An open delivery may already exist for this order. Check the list before creating another.",
        409,
      );
    return NextResponse.json({
      id: data.id,
      orderRef: ref,
      link: "/track-order#delivery=" + data.id + "." + access,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CourierError ? e.message : "Could not create delivery.",
      },
      { status: e instanceof CourierError ? e.status : 503 },
    );
  }
}
