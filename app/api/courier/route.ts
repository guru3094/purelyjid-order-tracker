import { randomBytes } from "node:crypto";
import { accessHash } from "@/lib/courier/repository";
import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { supabase } from "@/lib/supabase/client";
import {
  borzo,
  CourierError,
  quoteToken,
  readQuote,
} from "@/lib/courier/borzo";
import {
  shipment,
  publicShipment,
  saveShipment,
} from "@/lib/courier/repository";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (
      request.headers.get("origin") !==
      (process.env.APP_ORIGIN || "https://www.purelyjid.in")
    )
      throw new CourierError("Invalid origin.", 403);
    const text = await request.text();
    if (text.length > 12000) throw new CourierError("Request too large.");
    const b = JSON.parse(text);
    const staff = await isStaffAuthenticated();
    const s = await shipment(b.id, b.access, staff);
    if (b.action === "view")
      return NextResponse.json(publicShipment(s), {
        headers: { "Cache-Control": "no-store" },
      });
    if (b.action === "share") {
      if (!staff) throw new CourierError("Unauthorized", 403);
      const token = randomBytes(32).toString("base64url");
      await saveShipment(s.id, { access_hash: accessHash(token) });
      return NextResponse.json({
        link: "/track-order#delivery=" + s.id + "." + token,
      });
    }
    if (b.action === "quote") {
      if (!staff && !s.customer_enabled)
        throw new CourierError(
          "The studio will enable courier booking when your parcel is ready.",
          403,
        );
      if (s.state !== "draft")
        throw new CourierError(
          "This delivery has already been submitted. Refresh its status.",
          409,
        );
      const result = await borzo("calculate-order", s.input);
      if (
        result.warnings?.length ||
        !result.order?.payment_amount ||
        !/^\d+(\.\d{1,2})?$/.test(result.order.payment_amount)
      )
        throw new CourierError(
          "Borzo cannot offer a confirmed quote for these details.",
          502,
        );
      return NextResponse.json({
        amount: result.order.payment_amount,
        quote: quoteToken({
          shipment: s.id,
          input: s.input,
          amount: result.order.payment_amount,
          exp: Date.now() + 5 * 60 * 1000,
        }),
        test: process.env.BORZO_ENV !== "production",
      });
    }
    if (b.action === "book") {
      if (b.confirm !== true || (!staff && !s.customer_enabled))
        throw new CourierError(
          "Confirm the delivery charge before booking.",
          403,
        );
      const q = readQuote(b.quote);
      if (
        q.shipment !== s.id ||
        JSON.stringify(q.input) !== JSON.stringify(s.input)
      )
        throw new CourierError(
          "Delivery details changed. Get a new quote.",
          409,
        );
      const check = await borzo("calculate-order", s.input);
      if (check.warnings?.length || check.order?.payment_amount !== q.amount)
        throw new CourierError(
          "The courier price changed. Get a new quote.",
          409,
        );
      const { data, error } = await supabase
        .from("courier_shipments")
        .update({
          state: "submitting",
          amount: q.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id)
        .eq("state", "draft")
        .select("id");
      if (error || !data?.length)
        throw new CourierError(
          "Booking already submitted. Do not book again; refresh the status.",
          409,
        );
      try {
        const result = await borzo("create-order", {
          ...s.input,
          points: s.input.points.map((p) => ({
            ...p,
            client_order_id: s.id.replaceAll("-", ""),
          })),
        });
        if (!result.order?.order_id) throw new Error("Missing Borzo ID");
        await saveShipment(s.id, {
          state: "booked",
          borzo_id: result.order.order_id,
          provider_status: result.order.status,
          amount: result.order.payment_amount,
          delivery_status:
            result.order.points?.at(-1)?.delivery?.status || null,
        });
      } catch {
        await saveShipment(s.id, { state: "needs_review" });
        throw new CourierError(
          "Booking outcome needs checking. Do not retry or make another booking; contact the studio to reconcile it in Borzo.",
          502,
        );
      }
    } else if (b.action === "refresh") {
      if (!staff)
        throw new CourierError(
          "Use the latest delivery status shown here. Staff can request a provider refresh.",
          403,
        );
      if (s.borzo_id) {
        const result = await borzo("orders", { order_id: s.borzo_id });
        const o = result.orders?.find((o) => o.order_id === s.borzo_id);
        if (o)
          await saveShipment(s.id, {
            provider_status: o.status,
            delivery_status: o.points?.at(-1)?.delivery?.status || null,
            amount: o.payment_amount,
          });
      }
    } else if (b.action === "cancel") {
      if (!staff || b.confirm !== true)
        throw new CourierError("Staff confirmation required.", 403);
      if (!s.borzo_id)
        throw new CourierError("No confirmed courier booking to cancel.");
      const result = await borzo("cancel-order", { order_id: s.borzo_id });
      if (result.order)
        await saveShipment(s.id, {
          provider_status: result.order.status,
          state: "cancelled",
        });
    } else throw new CourierError("Unknown delivery action.");
    return NextResponse.json(
      publicShipment(await shipment(s.id, b.access, staff)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CourierError
            ? e.message
            : "Delivery service temporarily unavailable.",
      },
      { status: e instanceof CourierError ? e.status : 503 },
    );
  }
}
