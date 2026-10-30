"use client";
import { useEffect, useRef, useState } from "react";
import StaffNav from "../staff-nav";
import CourierPanel from "@/components/courier/CourierPanel";
type Row = {
  id: string;
  order_ref: string;
  state: string;
  provider: string;
  provider_status: string | null;
  amount: string | null;
};
const inputClass = "block w-full rounded border border-slate-300 p-3 my-2";
export default function CouriersClient() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(""),
    [editingRevision, setEditingRevision] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  async function load() {
    try {
      const r = await fetch("/api/staff/couriers");
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setRows(d.shipments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unavailable");
    }
  }
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/staff/couriers", { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setRows(d.shipments);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  async function edit(id: string) {
    try {
      const r = await fetch("/api/staff/couriers?id=" + encodeURIComponent(id)),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      const form = formRef.current;
      if (!form) return;
      for (const n of [
        "matter",
        "weight_grams",
        "length_cm",
        "width_cm",
        "height_cm",
        "declared_value",
        "invoice",
        "pincode",
        "city",
        "region",
        "shipping_mode",
      ])
        (form.elements.namedItem(n) as HTMLInputElement).value = String(
          d.input[n],
        );
      for (const [n, v] of Object.entries({
        orderRef: d.orderRef,
        name: d.input.points[1].contact_person.name,
        phone: d.input.points[1].contact_person.phone,
        address: d.input.points[1].address,
      }))
        (form.elements.namedItem(n) as HTMLInputElement).value = String(v);
      (form.elements.namedItem("enabled") as HTMLInputElement).checked =
        d.customerEnabled;
      (form.elements.namedItem("fragile") as HTMLInputElement).checked =
        d.input.fragile;
      setEditing(id);
      setEditingRevision(d.revision);
      setLink("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open request");
    }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setLink("");
    const f = new FormData(e.currentTarget),
      input: Record<string, unknown> = {};
    for (const n of [
      "matter",
      "invoice",
      "pincode",
      "city",
      "region",
      "shipping_mode",
    ])
      input[n] = String(f.get(n) || "");
    for (const n of [
      "weight_grams",
      "length_cm",
      "width_cm",
      "height_cm",
      "declared_value",
    ])
      input[n] = Number(f.get(n));
    input.fragile = f.get("fragile") === "on";
    input.points = [
      {},
      {
        address: f.get("address"),
        contact_person: { name: f.get("name"), phone: f.get("phone") },
      },
    ];
    try {
      const r = await fetch("/api/staff/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing || undefined,
          revision: editingRevision,
          orderRef: f.get("orderRef"),
          customerEnabled: f.get("enabled") === "on",
          input,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setLink(new URL(d.link, location.origin).toString());
      setSelected(d.id);
      setEditing("");
      formRef.current?.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create request");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <StaffNav />
      <main className="mx-auto max-w-5xl p-6 text-slate-900">
        <a href="/sales/orders" className="underline">
          Back to orders
        </a>
        <h1 className="my-5 text-3xl font-bold">Delhivery courier requests</h1>
        <p>
          Pickup is fixed to PurelyJid, Pimple Gurav, Pune 411027. Delivery is
          available within Pune and across India where Delhivery serves the
          destination PIN. Customer acceptance never books a shipment. Confirm
          offline payment before dispatch.
        </p>
        {error && (
          <p role="alert" className="my-4 text-red-700">
            {error}
          </p>
        )}
        <form
          ref={formRef}
          onSubmit={create}
          className="my-6 rounded-xl border bg-white p-5"
        >
          <h2 className="text-xl font-semibold">
            {editing ? "Edit delivery proposal" : "Create a delivery proposal"}
          </h2>
          <p className="my-2 text-sm">
            Changes require fresh customer acceptance and payment confirmation.
            Reconcile earlier offline payments separately.
          </p>
          <label>
            Existing order reference (optional)
            <input name="orderRef" maxLength={100} className={inputClass} />
          </label>
          <p className="text-sm">Leave blank for an ad hoc PJC reference.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { n: "matter", label: "Parcel contents" },
              { n: "invoice", label: "Invoice / sale reference" },
              { n: "name", label: "Recipient name" },
              { n: "phone", label: "Recipient mobile" },
              { n: "pincode", label: "Delivery PIN code" },
              { n: "city", label: "Delivery city" },
              { n: "region", label: "Delivery state" },
            ].map((x) => (
              <label key={x.n}>
                {x.label}
                <input
                  name={x.n}
                  required
                  maxLength={
                    x.n === "matter" ? 500 : x.n === "pincode" ? 6 : 100
                  }
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <label>
            Full delivery address
            <textarea
              name="address"
              required
              minLength={10}
              maxLength={350}
              className={inputClass}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "weight_grams", label: "Packed weight (grams)", max: 20000 },
              { n: "length_cm", label: "Length (cm)", max: 100 },
              { n: "width_cm", label: "Width (cm)", max: 100 },
              { n: "height_cm", label: "Height (cm)", max: 100 },
              {
                n: "declared_value",
                label: "Invoice value (₹)",
                max: 49999.99,
              },
            ].map((x) => (
              <label key={x.n}>
                {x.label}
                <input
                  name={x.n}
                  required
                  type="number"
                  min={1}
                  max={x.max}
                  step={0.01}
                  className={inputClass}
                />
              </label>
            ))}
            <label>
              Service
              <select name="shipping_mode" className={inputClass}>
                <option>Surface</option>
                <option>Express</option>
              </select>
            </label>
          </div>
          <label className="block my-3">
            <input type="checkbox" name="fragile" /> Fragile parcel (pack
            securely and follow Delhivery restrictions)
          </label>
          <label className="block my-3">
            <input type="checkbox" name="enabled" defaultChecked /> Allow
            customer to accept or decline this proposal
          </label>
          <p className="my-3 text-sm">
            One packed box per request, up to 20 kg and invoice value below
            ₹50,000. Use Delhivery One directly for multi-box, higher-value or
            restricted goods. Rate estimates may change after carrier
            weight/dimension assessment.
          </p>
          <button
            disabled={busy}
            className="rounded bg-slate-900 px-5 py-3 text-white disabled:opacity-40"
          >
            {busy
              ? "Checking serviceability and rate…"
              : editing
                ? "Recalculate & save proposal"
                : "Get estimate & create request"}
          </button>
        </form>
        {link && (
          <div className="my-4 rounded bg-slate-100 p-4">
            <p>Private customer acceptance and tracking link:</p>
            <a href={link} className="break-all underline">
              {link}
            </a>
          </div>
        )}
        <h2 className="text-xl font-bold">Recent requests</h2>
        <button onClick={load} className="my-3 underline">
          Refresh list
        </button>
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-b py-3">
              <button onClick={() => setSelected(r.id)} className="underline">
                {r.order_ref}
              </button>{" "}
              · {r.provider} · {r.state.replaceAll("_", " ")}
              {r.amount ? " · ₹" + r.amount : ""}
              {r.provider === "delhivery" &&
                [
                  "requested",
                  "accepted",
                  "declined",
                  "payment_confirmed",
                ].includes(r.state) && (
                  <button onClick={() => edit(r.id)} className="ml-3 underline">
                    Edit / recalculate
                  </button>
                )}
            </li>
          ))}
        </ul>
        {selected && <CourierPanel key={selected} staffId={selected} />}
      </main>
    </>
  );
}
