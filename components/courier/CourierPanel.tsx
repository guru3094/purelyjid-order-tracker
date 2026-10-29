"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
type Delivery = {
  id: string;
  order_ref: string;
  state: string;
  provider_status: string | null;
  delivery_status: string | null;
  amount: string | null;
  customer_enabled: boolean;
  test: boolean;
  updated_at: string;
  points: { address: string; name: string; phone: string; pays: boolean }[];
};
const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
export default function CourierPanel({ staffId }: { staffId?: string }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<{
      quote: string;
      amount: string;
      test: boolean;
    } | null>(null),
    [consent, setConsent] = useState(false),
    [share, setShare] = useState("");
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const match = hash.match(/^#delivery=([a-f\d-]{36})\.([\w-]{43})$/i);
  const id = staffId || match?.[1] || "",
    access = match?.[2] || "";
  useEffect(() => {
    if (!id) return;
    let active = true;
    const controller = new AbortController();
    fetch("/api/courier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, access, action: "view" }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) setDelivery(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
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
          quote: quote?.quote,
          confirm: consent,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "share") {
        setShare(new URL(d.link, location.origin).toString());
      } else if (action === "quote") {
        setQuote(d);
        setConsent(false);
      } else {
        setDelivery(d);
        setQuote(null);
        setConsent(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setQuote(null);
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
          <p className="my-3">Order {delivery.order_ref}</p>
          <div className="my-3">
            {delivery.points?.map((p, i) => (
              <p key={i}>
                {i === 0 ? "Pickup" : "Delivery"}: {p.address} · {p.name} ·{" "}
                {p.phone}
                {p.pays ? " · Pays courier charge in cash" : ""}
              </p>
            ))}
          </div>
          <p>
            Status:{" "}
            {delivery.delivery_status ||
              delivery.provider_status ||
              delivery.state}
          </p>
          <p className="text-sm">
            Updated: {new Date(delivery.updated_at).toLocaleString()}
          </p>
          {delivery.test && (
            <p className="my-2 font-semibold">
              Test mode — no live courier is booked.
            </p>
          )}
          {delivery.state === "needs_review" ||
          delivery.state === "submitting" ? (
            <p>Staff are checking this booking. Do not book another courier.</p>
          ) : null}
          {delivery.state === "draft" &&
            (delivery.customer_enabled || staffId) && (
              <>
                <p className="my-3">
                  Request a delivery quote for the pickup and delivery details
                  confirmed with the studio. Your contact details and addresses
                  will be shared with Borzo. Delivery charges are paid in cash
                  at the location selected by staff.
                </p>
                <button
                  disabled={busy}
                  onClick={() => act("quote")}
                  className="rounded-lg bg-slate-900 px-5 py-3 text-white"
                >
                  Get delivery quote
                </button>
              </>
            )}
          {quote && (
            <div className="my-4 rounded-xl bg-slate-100 p-4">
              <p className="font-bold">
                Quoted courier charge: ₹{quote.amount}
              </p>
              <p>
                Quote valid for 5 minutes. A price change will require a new
                quote.
              </p>
              <label className="my-3 block">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                I confirm the courier charge and authorize this booking.
              </label>
              <button
                disabled={busy || !consent}
                onClick={() => act("book")}
                className="rounded-lg bg-slate-900 px-5 py-3 text-white"
              >
                {quote.test
                  ? "Confirm test booking"
                  : "Confirm and book courier"}
              </button>
            </div>
          )}
          {staffId && (
            <div className="my-3">
              <button
                onClick={() => act("share")}
                disabled={busy}
                className="underline"
              >
                Create a new private customer link
              </button>
              {share && <p className="break-all">{share}</p>}
            </div>
          )}
          {staffId && delivery.state === "booked" && (
            <div className="my-4">
              <button
                disabled={busy}
                onClick={() => act("refresh")}
                className="mr-3 underline"
              >
                Refresh from Borzo
              </button>
              <label className="block my-2">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                I authorize cancellation; Borzo may apply charges.
              </label>
              <button
                disabled={busy || !consent}
                onClick={() => act("cancel")}
                className="text-red-700 underline"
              >
                Cancel courier
              </button>
            </div>
          )}
          <p className="mt-4 text-sm">
            Parcel preparation and courier delivery are tracked separately.
            Refresh this page for the latest received status.
          </p>
        </>
      )}
    </section>
  );
}
