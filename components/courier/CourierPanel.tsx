"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
type Delivery = {
  id: string;
  order_ref: string;
  provider: string;
  revision: number;
  state: string;
  provider_status: string | null;
  delivery_status: string | null;
  amount: string | null;
  customer_enabled: boolean;
  test: boolean;
  dispatch_enabled: boolean;
  updated_at: string;
  accepted_at: string | null;
  payment_confirmed_at: string | null;
  awb: string | null;
  pickup_date: string | null;
  pickup_request_id: string | null;
  points: { address: string; name: string; phone: string }[];
};
const labels: Record<string, string> = {
  requested: "Awaiting customer response",
  accepted: "Accepted · awaiting offline payment",
  declined: "Declined by customer",
  payment_confirmed: "Payment confirmed · awaiting shipment creation",
  submitting: "Checking shipment creation — do not retry",
  cancelling: "Cancellation is being checked — do not repeat",
  needs_review: "Staff review required — do not rebook",
  manifested: "Shipment created · label and pickup scheduling pending",
  booked: "Pickup scheduled",
  cancelled: "Cancelled",
};
const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const button =
  "my-2 mr-3 rounded-lg bg-slate-900 px-5 py-3 text-white disabled:opacity-40";
export default function CourierPanel({ staffId }: { staffId?: string }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [share, setShare] = useState(""),
    [paymentReference, setPaymentReference] = useState(""),
    [paidAmount, setPaidAmount] = useState(""),
    [pickupDate, setPickupDate] = useState("");
  const hash = useSyncExternalStore(
      subscribe,
      () => window.location.hash,
      () => "",
    ),
    match = hash.match(/^#delivery=([a-f\d-]{36})\.([\w-]{43})$/i);
  const id = staffId || match?.[1] || "",
    access = match?.[2] || "";
  useEffect(() => {
    if (!id) return;
    const c = new AbortController();
    fetch("/api/courier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, access, action: "view" }),
      signal: c.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setDelivery(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, access]);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/courier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          access,
          action,
          revision: delivery?.revision,
          confirm,
          paymentReference,
          paidAmount,
          pickupDate,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "share")
        setShare(new URL(d.link, location.origin).toString());
      else setDelivery(d);
      setConfirm(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Request failed. Refresh the latest status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!id) return null;
  return (
    <section className="mx-auto my-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
      <h2 className="text-2xl font-bold">Your courier delivery</h2>
      {error && (
        <p role="alert" className="my-3 text-red-700">
          {error}
        </p>
      )}
      {delivery && (
        <>
          <p className="my-3 font-semibold">
            Order {delivery.order_ref} ·{" "}
            {delivery.provider === "delhivery"
              ? "Delhivery"
              : "Legacy Borzo request"}
          </p>
          {delivery.points.map((p, i) => (
            <p key={i} className="my-2">
              {i === 0 ? "Pickup" : "Delivery"}: {p.address} · {p.name} ·{" "}
              {p.phone}
            </p>
          ))}
          <p className="my-4 font-semibold">
            {labels[delivery.state] || delivery.state}
          </p>
          {delivery.provider_status && (
            <p>Courier status: {delivery.provider_status}</p>
          )}
          <p className="text-sm">
            Updated {new Date(delivery.updated_at).toLocaleString()}
          </p>
          {delivery.amount && (
            <p className="my-3 text-lg">
              Delivery charge: ₹{Number(delivery.amount).toFixed(2)}
            </p>
          )}
          {delivery.awb && <p>AWB: {delivery.awb}</p>}
          {delivery.pickup_date && (
            <p>
              Pickup: {delivery.pickup_date}, 6–9 PM
              {delivery.pickup_request_id
                ? " · Request " + delivery.pickup_request_id
                : ""}
            </p>
          )}
          {delivery.provider === "delhivery" && (
            <>
              {!delivery.dispatch_enabled && !delivery.test && (
                <p className="my-3 rounded bg-amber-50 p-3">
                  Live dispatch is not activated. Accepting a request or
                  recording payment will not dispatch a courier.
                </p>
              )}
              {delivery.test && (
                <p className="my-3 font-semibold">
                  Staging mode — no live dispatch.
                </p>
              )}
              {!staffId &&
                delivery.state === "requested" &&
                delivery.customer_enabled && (
                  <>
                    <p className="my-3">
                      Please review the delivery address and charge. Acceptance
                      does not book a courier. Pay PurelyJid offline using the
                      instructions shared by our team; dispatch is booked only
                      after our team confirms receipt. If the estimate changes
                      before booking, we will ask you to review it again.
                    </p>
                    <label className="block my-3">
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />{" "}
                      I have reviewed this request and the delivery charge. My
                      delivery details will be shared with Delhivery when staff
                      books dispatch.
                    </label>
                    <button
                      className={button}
                      disabled={busy || !confirm}
                      onClick={() => act("accept")}
                    >
                      Accept delivery request
                    </button>
                    <button
                      className={button}
                      disabled={busy || !confirm}
                      onClick={() => act("decline")}
                    >
                      Decline delivery request
                    </button>
                  </>
                )}
              {!staffId && delivery.state === "accepted" && (
                <p className="my-3">
                  Thank you. Please complete offline payment with the PurelyJid
                  team. We will confirm payment before booking your courier.
                </p>
              )}
              {staffId && delivery.state === "accepted" && (
                <div className="my-4 rounded bg-slate-50 p-4">
                  <h3 className="font-bold">
                    Confirm offline delivery payment
                  </h3>
                  <p>
                    Record the delivery charge only. Keep merchandise payment in
                    the sales order.
                  </p>
                  <label className="block my-2">
                    Amount received (₹)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="block border p-2"
                    />
                  </label>
                  <label className="block my-2">
                    Payment reference / cash receipt
                    <input
                      maxLength={120}
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="block border p-2"
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />{" "}
                    I have received the accepted delivery charge.
                  </label>
                  <button
                    className={button}
                    disabled={
                      busy || !confirm || !paymentReference || !paidAmount
                    }
                    onClick={() => act("confirm_payment")}
                  >
                    Confirm payment received
                  </button>
                </div>
              )}
              {staffId && delivery.state === "payment_confirmed" && (
                <>
                  <label className="block my-3">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />{" "}
                    Payment is received and parcel details are correct. I
                    authorize shipment creation and the applicable Delhivery
                    account charge.
                  </label>
                  <button
                    className={button}
                    disabled={
                      busy ||
                      !confirm ||
                      (!delivery.dispatch_enabled && !delivery.test)
                    }
                    onClick={() => act("book")}
                  >
                    Create Delhivery shipment
                  </button>
                </>
              )}
              {staffId && delivery.state === "manifested" && (
                <div className="my-4 rounded border p-4">
                  <p>
                    Print and attach the shipping label for AWB {delivery.awb}{" "}
                    from Delhivery One before scheduling pickup. This uses the
                    existing shipment; it does not create another AWB.
                  </p>
                  <a
                    className="underline"
                    href="https://one.delhivery.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Delhivery One for label
                  </a>
                  <label className="block my-3">
                    Pickup date (Tuesday–Saturday, 6–9 PM)
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="block border p-2"
                    />
                  </label>
                  <label className="block">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />{" "}
                    Parcel is packed and labeled; I authorize scheduling pickup.
                  </label>
                  <button
                    className={button}
                    disabled={
                      busy ||
                      !confirm ||
                      !pickupDate ||
                      (!delivery.dispatch_enabled && !delivery.test)
                    }
                    onClick={() => act("schedule_pickup")}
                  >
                    Schedule pickup
                  </button>
                  <p className="text-sm">
                    An existing confirmed pickup for this warehouse/date is
                    reused. Check its parcel count in Delhivery One before
                    handover.
                  </p>
                </div>
              )}
              {staffId && delivery.awb && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => act("refresh")}
                >
                  Refresh Delhivery tracking
                </button>
              )}
              {staffId &&
                ![
                  "submitting",
                  "cancelling",
                  "needs_review",
                  "cancelled",
                  "declined",
                ].includes(delivery.state) && (
                  <div className="my-3">
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />{" "}
                      Cancel this request/shipment. Any paid charge or provider
                      cancellation fee must be reconciled separately.
                    </label>
                    <button
                      className={button}
                      disabled={busy || !confirm}
                      onClick={() => act("cancel")}
                    >
                      Cancel request / shipment
                    </button>
                  </div>
                )}
            </>
          )}
          {delivery.provider !== "delhivery" && (
            <p className="my-3">
              This old request cannot book a courier. Contact PurelyJid for a
              new Delhivery request.
            </p>
          )}
          {staffId &&
            delivery.provider === "borzo" &&
            delivery.state === "draft" && (
              <>
                <label className="block">
                  <input
                    type="checkbox"
                    checked={confirm}
                    onChange={(e) => setConfirm(e.target.checked)}
                  />{" "}
                  Close this unbooked legacy request.
                </label>
                <button
                  className={button}
                  disabled={busy || !confirm}
                  onClick={() => act("cancel")}
                >
                  Close old request
                </button>
              </>
            )}
          <button
            className="mr-4 my-3 underline"
            disabled={busy}
            onClick={() => act("view")}
          >
            Refresh status
          </button>
          {staffId && (
            <>
              <button
                className="my-3 underline"
                disabled={busy}
                onClick={() => act("share")}
              >
                Generate new private customer link
              </button>
              {share && <p className="break-all">{share}</p>}
            </>
          )}
          <p className="mt-4 text-sm">
            Courier progress and product-order completion are separate. Tracking
            refreshes on page load or when you refresh status.
          </p>
        </>
      )}
    </section>
  );
}
