import { supabase } from "@/lib/supabase/client";
import { CourierError } from "./borzo";
import { type Shipment, shipment, saveShipment } from "./repository";
import {
  type DelhiveryInput,
  estimateDelivery,
  manifest,
  delhivery,
  requireDispatchEnabled,
  validPickupDate,
  trackingSnapshot,
} from "./delhivery";
export async function transition(
  s: Shipment,
  patch: object,
  expected = s.state,
) {
  const { data, error } = await supabase
    .from("courier_shipments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", s.id)
    .eq("state", expected)
    .eq("revision", s.revision)
    .select("id");
  if (error || !data?.length)
    throw new CourierError(
      "This request changed. Refresh before continuing.",
      409,
    );
}
export async function refreshDelhivery(s: Shipment, force = false) {
  if (!s.delhivery_awb || s.provider !== "delhivery") return s;
  const cutoff = new Date(Date.now() - 120000).toISOString();
  if (!force && s.provider_checked_at && s.provider_checked_at > cutoff)
    return s;
  // Atomic two-minute claim also limits simultaneous customer/staff refreshes across server instances.
  let claim = supabase
    .from("courier_shipments")
    .update({ provider_checked_at: new Date().toISOString() })
    .eq("id", s.id);
  claim = s.provider_checked_at
    ? claim.eq("provider_checked_at", s.provider_checked_at)
    : claim.is("provider_checked_at", null);
  const { data, error } = await claim.select("id");
  if (error || !data?.length) return s;
  try {
    const status = trackingSnapshot(
      await delhivery("/api/v1/packages/json/", {
        query: { waybill: s.delhivery_awb },
      }),
      s.delhivery_awb,
    );
    if (!s.provider_updated_at || status.at > s.provider_updated_at) {
      const update = supabase
        .from("courier_shipments")
        .update({
          provider_status: status.status,
          provider_updated_at: status.at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      const result = await (s.provider_updated_at
        ? update.eq("provider_updated_at", s.provider_updated_at)
        : update.is("provider_updated_at", null));
      if (result.error) throw new Error("Tracking storage unavailable");
    }
    return await shipment(s.id, undefined, true);
  } catch {
    if (force)
      throw new CourierError(
        "Tracking refresh failed. The last saved status is still available.",
        502,
      );
    return s;
  }
}
export async function schedulePickup(s: Shipment, date: unknown) {
  requireDispatchEnabled();
  const pickup_date = validPickupDate(date),
    location = process.env.DELHIVERY_PICKUP_LOCATION || "PurelyJid";
  if (
    !s.delhivery_awb ||
    !s.payment_confirmed_at ||
    !["manifested", "booked"].includes(s.state)
  )
    throw new CourierError(
      "A confirmed, paid shipment is required before scheduling pickup.",
      409,
    );
  if (s.state === "booked") {
    if (s.pickup_date === pickup_date) return;
    throw new CourierError(
      "A pickup is already assigned. Manage changes in Delhivery One.",
      409,
    );
  }
  const existing = await supabase
    .from("delhivery_pickups")
    .select("*")
    .eq("location", location)
    .eq("pickup_date", pickup_date)
    .maybeSingle();
  if (existing.error)
    throw new CourierError("Pickup storage unavailable.", 503);
  if (existing.data) {
    if (existing.data.state !== "confirmed")
      throw new CourierError(
        "A pickup for this location/date needs checking in Delhivery. Do not submit another pickup.",
        409,
      );
    await transition(s, {
      state: "booked",
      pickup_date,
      pickup_request_id: existing.data.provider_id,
    });
    return;
  }
  const countResult = await supabase
    .from("courier_shipments")
    .select("id", { count: "exact", head: true })
    .eq("provider", "delhivery")
    .eq("state", "manifested");
  if (countResult.error)
    throw new CourierError("Could not count ready parcels.", 503);
  const expected_package_count = Math.max(1, countResult.count || 1);
  const claim = await supabase
    .from("delhivery_pickups")
    .insert({
      location,
      pickup_date,
      state: "submitting",
      expected_package_count,
    })
    .select("id")
    .single();
  if (claim.error)
    throw new CourierError(
      "Another pickup request is in progress. Refresh and check Delhivery.",
      409,
    );
  try {
    const result = await delhivery("/fm/request/new/", {
      method: "POST",
      write: true,
      body: {
        pickup_date,
        pickup_time: "18:00:00",
        pickup_location: location,
        expected_package_count,
      },
    });
    if (!result.pickup_id || result.error || result.success === false)
      throw new Error("Pickup not confirmed");
    const provider_id = String(result.pickup_id);
    const save = await supabase
      .from("delhivery_pickups")
      .update({
        state: "confirmed",
        provider_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.data.id);
    if (save.error) throw new Error("Pickup storage failed");
    await transition(s, {
      state: "booked",
      pickup_date,
      pickup_request_id: provider_id,
    });
  } catch {
    await supabase
      .from("delhivery_pickups")
      .update({ state: "needs_review" })
      .eq("id", claim.data.id)
      .neq("state", "confirmed");
    throw new CourierError(
      "Pickup outcome needs staff review in Delhivery. Your shipment remains created; do not create another shipment or pickup.",
      502,
    );
  }
}
export async function delhiveryAction(
  s: Shipment,
  b: Record<string, unknown>,
  staff: boolean,
) {
  const input = s.input as DelhiveryInput;
  if (b.action === "accept" || b.action === "decline") {
    if (staff)
      throw new CourierError(
        "The customer must accept or decline using their private link.",
        403,
      );
    if (!s.customer_enabled || b.revision !== s.revision || b.confirm !== true)
      throw new CourierError("Review and confirm the current request.", 409);
    if (s.state !== "requested")
      throw new CourierError(
        "This request has already been answered or changed.",
        409,
      );
    await transition(s, {
      state: b.action === "accept" ? "accepted" : "declined",
      accepted_at: b.action === "accept" ? new Date().toISOString() : null,
    });
    return;
  }
  if (!staff)
    throw new CourierError(
      "Only PurelyJid staff can confirm payment or book dispatch.",
      403,
    );
  if (b.action === "confirm_payment") {
    if (
      s.state !== "accepted" ||
      b.revision !== s.revision ||
      b.confirm !== true
    )
      throw new CourierError(
        "Customer acceptance and staff confirmation are required.",
        409,
      );
    const reference = String(b.paymentReference || "").trim();
    if (
      reference.length < 3 ||
      reference.length > 120 ||
      Number(b.paidAmount) !== Number(s.amount)
    )
      throw new CourierError(
        "Enter the offline payment reference and the exact accepted delivery charge.",
      );
    await transition(s, {
      state: "payment_confirmed",
      payment_confirmed_at: new Date().toISOString(),
      payment_reference: reference,
      paid_amount: s.amount,
    });
    return;
  }
  if (b.action === "book") {
    if (
      b.confirm !== true ||
      b.revision !== s.revision ||
      s.state !== "payment_confirmed" ||
      !s.accepted_at ||
      !s.payment_confirmed_at ||
      Number(s.paid_amount) !== Number(s.amount)
    )
      throw new CourierError(
        "Customer acceptance and confirmed delivery payment are required before booking.",
        409,
      );
    requireDispatchEnabled();
    // Recalculate before claiming the dispatch. A change requires a new customer response and new payment confirmation.
    const price = await estimateDelivery(input);
    if (Number(price) !== Number(s.amount)) {
      await transition(s, {
        state: "requested",
        revision: s.revision + 1,
        amount: price,
        accepted_at: null,
        payment_confirmed_at: null,
        payment_reference: null,
        paid_amount: null,
        quote_checked_at: new Date().toISOString(),
      });
      throw new CourierError(
        "Delivery estimate changed. Customer must accept the updated charge; reconcile the previous payment and confirm again.",
        409,
      );
    }
    await transition(s, { state: "submitting" });
    try {
      const awb = await manifest(input, "PJD" + s.id.replaceAll("-", ""));
      await saveShipment(s.id, {
        delhivery_awb: awb,
        state: "manifested",
        provider_status: "Manifested",
      });
    } catch {
      await saveShipment(s.id, { state: "needs_review" });
      throw new CourierError(
        "Shipment outcome needs staff reconciliation in Delhivery. Do not book again.",
        502,
      );
    }
    return;
  }
  if (b.action === "schedule_pickup") {
    if (b.confirm !== true)
      throw new CourierError("Confirm parcel is packed and labeled.");
    await schedulePickup(s, b.pickupDate);
    return;
  }
  if (b.action === "refresh") {
    await refreshDelhivery(s, true);
    return;
  }
  if (b.action === "cancel") {
    if (b.confirm !== true)
      throw new CourierError("Confirm cancellation; charges may apply.");
    if (["submitting", "cancelling", "needs_review"].includes(s.state))
      throw new CourierError(
        "Reconcile this shipment in Delhivery before cancellation.",
        409,
      );
    if (s.state === "cancelled") return;
    if (s.delhivery_awb) {
      requireDispatchEnabled();
      await transition(s, { state: "cancelling" });
      try {
        const result = await delhivery("/api/p/edit", {
          method: "POST",
          write: true,
          body: { waybill: s.delhivery_awb, cancellation: "true" },
        });
        if (result.status !== true)
          throw new CourierError(
            "Cancellation was not confirmed. Check Delhivery before retrying.",
            502,
          );
        await saveShipment(s.id, {
          state: "cancelled",
          provider_status: "Cancellation requested",
        });
      } catch {
        await saveShipment(s.id, { state: "needs_review" });
        throw new CourierError(
          "Cancellation outcome needs checking in Delhivery. Do not resubmit cancellation or book again.",
          502,
        );
      }
      return;
    }
    await transition(s, {
      state: "cancelled",
      provider_status: s.delhivery_awb ? "Cancellation requested" : "Cancelled",
    });
    return;
  }
  throw new CourierError("Unknown delivery action.");
}
