"use client";
import { useEffect, useState, useRef } from "react";
import StaffNav from "../staff-nav";
import CourierPanel from "@/components/courier/CourierPanel";
type Row = {
  id: string;
  order_ref: string;
  state: string;
  provider_status: string | null;
};
const inputClass = "block w-full rounded border border-slate-300 p-3 my-2";
export default function CouriersClient() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState("");
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
    const controller = new AbortController();
    fetch("/api/staff/couriers", { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setRows(d.shipments);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function edit(id: string) {
    setError("");
    try {
      const r = await fetch("/api/staff/couriers?id=" + encodeURIComponent(id));
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      const form = formRef.current;
      if (!form) return;
      const set = (n: string, v: string) => {
        (form.elements.namedItem(n) as HTMLInputElement).value = v;
      };
      set("orderRef", d.orderRef);
      set("matter", d.input.matter);
      set("weight", String(d.input.total_weight_kg));
      ["pickup", "drop"].forEach((p, i) => {
        set(p + "Address", d.input.points[i].address);
        set(p + "Name", d.input.points[i].contact_person.name);
        set(p + "Phone", d.input.points[i].contact_person.phone);
      });
      set("payer", d.input.points[0].is_order_payment_here ? "0" : "1");
      (form.elements.namedItem("enabled") as HTMLInputElement).checked =
        d.customerEnabled;
      setEditing(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open draft");
    }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setLink("");
    const f = new FormData(e.currentTarget);
    const payer = f.get("payer");
    const point = (prefix: string, index: number) => ({
      address: f.get(prefix + "Address"),
      contact_person: {
        name: f.get(prefix + "Name"),
        phone: f.get(prefix + "Phone"),
      },
      is_order_payment_here: payer === String(index),
    });
    try {
      const r = await fetch("/api/staff/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing || undefined,
          orderRef: f.get("orderRef"),
          customerEnabled: f.get("enabled") === "on",
          input: {
            matter: f.get("matter"),
            total_weight_kg: Number(f.get("weight")),
            points: [point("pickup", 0), point("drop", 1)],
          },
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
      setError(e instanceof Error ? e.message : "Could not create delivery");
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
        <h1 className="my-5 text-3xl font-bold">Courier bookings</h1>
        <p>
          Create a delivery linked to an existing order, or leave the reference
          blank for an ad hoc pickup. Creating a request does not dispatch a
          courier. Review the quote and confirm separately.
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
          <label>
            Existing order reference (optional)
            <input name="orderRef" maxLength={100} className={inputClass} />
          </label>
          <label>
            Parcel contents, including fragile handling
            <input
              name="matter"
              required
              maxLength={1000}
              className={inputClass}
            />
          </label>
          <label>
            Total weight, rounded up (kg)
            <input
              name="weight"
              type="number"
              min={1}
              max={20}
              step={1}
              required
              className={inputClass}
            />
          </label>
          <div className="grid gap-5 md:grid-cols-2">
            {["pickup", "drop"].map((p) => (
              <fieldset key={p}>
                <legend className="font-bold">
                  {p === "pickup" ? "Pickup" : "Delivery"}
                </legend>
                <label>
                  Full address
                  <textarea
                    name={p + "Address"}
                    required
                    minLength={10}
                    maxLength={350}
                    className={inputClass}
                  />
                </label>
                <label>
                  Contact name
                  <input
                    name={p + "Name"}
                    required
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label>
                  Mobile number
                  <input
                    name={p + "Phone"}
                    type="tel"
                    required
                    className={inputClass}
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <label>
            Pay delivery charge in cash at
            <select name="payer" className={inputClass}>
              <option value="1">Delivery address (recipient pays)</option>
              <option value="0">Pickup address</option>
            </select>
          </label>
          <label className="block my-4">
            <input name="enabled" type="checkbox" /> Parcel is ready: allow
            customer to quote and book using a private link
          </label>
          <button
            disabled={busy}
            className="rounded bg-slate-900 px-5 py-3 text-white"
          >
            {editing ? "Save draft changes" : "Create courier request"}
          </button>
        </form>
        {link && (
          <div className="my-4 rounded bg-slate-100 p-4">
            <p>
              Private booking and tracking link — share only with this customer:
            </p>
            <a href={link} className="break-all underline">
              {link}
            </a>
          </div>
        )}
        <h2 className="text-xl font-bold">Recent delivery requests</h2>
        <button onClick={load} className="my-2 underline">
          Refresh list
        </button>
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-b py-3">
              <button onClick={() => setSelected(r.id)} className="underline">
                {r.order_ref}
              </button>{" "}
              · {r.provider_status || r.state}
              {r.state === "draft" && (
                <button onClick={() => edit(r.id)} className="ml-3 underline">
                  Edit draft / enable customer booking
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
