import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { supabase } from "@/lib/supabase/client";
import { readOrdersSheet } from "@/lib/google/sheets";
import { accessHash, shipment } from "@/lib/courier/repository";
import { CourierError } from "@/lib/courier/borzo";
import { validateDelhivery, estimateDelivery } from "@/lib/courier/delhivery";
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
          revision: s.revision,
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
      "id,order_ref,state,provider_status,delivery_status,amount,updated_at,provider,customer_enabled,revision,delhivery_awb",
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
    const input = validateDelhivery(b.input);
    let ref = String(b.orderRef || "").trim();
    const existing = b.id ? await shipment(b.id, undefined, true) : null;
    if (existing) {
      if (b.revision !== existing.revision)
        throw new CourierError(
          "This proposal changed. Reopen it before editing.",
          409,
        );
      if (
        existing.provider !== "delhivery" ||
        !["requested", "accepted", "declined", "payment_confirmed"].includes(
          existing.state,
        )
      )
        throw new CourierError(
          "Only an unbooked Delhivery request can be edited.",
          409,
        );
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
    const amount = await estimateDelivery(input);
    const access = randomBytes(32).toString("base64url");
    if (existing) {
      const { data, error } = await supabase
        .from("courier_shipments")
        .update({
          input,
          provider: "delhivery",
          state: "requested",
          amount,
          revision: existing.revision + 1,
          accepted_at: null,
          payment_confirmed_at: null,
          payment_reference: null,
          paid_amount: null,
          quote_checked_at: new Date().toISOString(),
          access_hash: accessHash(access),
          customer_enabled: b.customerEnabled === true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("state", existing.state)
        .eq("revision", existing.revision)
        .select("id");
      if (error || !data?.length)
        throw new CourierError("Request changed. Reload before editing.", 409);
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
        provider: "delhivery",
        state: "requested",
        amount,
        quote_checked_at: new Date().toISOString(),
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
