import { createHmac, timingSafeEqual } from "node:crypto";
export type Point = {
  address: string;
  contact_person: { name: string; phone: string };
  client_order_id?: string;
  is_order_payment_here?: boolean;
};
export type BookingInput = {
  matter: string;
  total_weight_kg: number;
  points: Point[];
  type: "standard";
  vehicle_type_id: 8;
  payment_method: "cash";
};
export type BorzoOrder = {
  order_id: number;
  status: string;
  payment_amount: string;
  points?: { tracking_url?: string; delivery?: { status?: string } }[];
};
export class CourierError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function signed(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function validSignature(
  value: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signed(value, secret), "hex"),
    Buffer.from(signature, "hex"),
  );
}
export function validateBooking(value: unknown): BookingInput {
  const v = value as BookingInput;
  if (
    !v ||
    typeof v.matter !== "string" ||
    !v.matter.trim() ||
    v.matter.length > 1000 ||
    !Number.isInteger(v.total_weight_kg) ||
    v.total_weight_kg < 1 ||
    v.total_weight_kg > 20 ||
    !Array.isArray(v.points) ||
    v.points.length !== 2
  )
    throw new CourierError(
      "Enter parcel contents, whole weight (1–20 kg), pickup and delivery.",
    );
  const points = v.points.map((p) => {
    const phone = String(p.contact_person?.phone || "").replace(/\D/g, "");
    if (
      typeof p.address !== "string" ||
      p.address.trim().length < 10 ||
      p.address.length > 350 ||
      !/^(91)?[6-9]\d{9}$/.test(phone) ||
      typeof p.contact_person?.name !== "string" ||
      !p.contact_person.name.trim() ||
      p.contact_person.name.length > 100
    )
      throw new CourierError(
        "Enter full addresses, contact names and valid Indian mobile numbers.",
      );
    return {
      address: p.address.trim(),
      contact_person: {
        name: p.contact_person.name.trim(),
        phone: phone.length === 10 ? "91" + phone : phone,
      },
      is_order_payment_here: !!p.is_order_payment_here,
    };
  });
  if (points.filter((p) => p.is_order_payment_here).length !== 1)
    throw new CourierError(
      "Select where the courier delivery charge will be paid in cash.",
    );
  return {
    type: "standard",
    matter: v.matter.trim(),
    total_weight_kg: v.total_weight_kg,
    points,
    vehicle_type_id: 8,
    payment_method: "cash",
  };
}
export async function borzo(
  method: "calculate-order" | "create-order" | "cancel-order" | "orders",
  body?: unknown,
): Promise<{ order?: BorzoOrder; orders?: BorzoOrder[]; warnings?: string[] }> {
  const token = process.env.BORZO_AUTH_TOKEN;
  if (!token)
    throw new CourierError("Courier integration is not configured yet.", 503);
  const production = process.env.BORZO_ENV === "production";
  if (production && process.env.BORZO_LIVE_ENABLED !== "true")
    throw new CourierError("Live courier booking is not enabled.", 503);
  const base = production
    ? "https://robot-in.borzodelivery.com/api/business/1.8"
    : "https://robotapitest-in.borzodelivery.com/api/business/1.8";
  const url = new URL(base + "/" + method);
  if (method === "orders" && body)
    for (const [k, v] of Object.entries(body))
      url.searchParams.set(k, String(v));
  const response = await fetch(url, {
    method: method === "orders" ? "GET" : "POST",
    headers: { "X-DV-Auth-Token": token, "Content-Type": "application/json" },
    body: method === "orders" ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || !data.is_successful)
    throw new CourierError(
      "Borzo could not process this request. Check the addresses, service availability and account settings.",
      502,
    );
  return data;
}
export function quoteToken(payload: unknown) {
  const secret = process.env.COURIER_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    throw new CourierError("Courier signing configuration is missing.", 503);
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + signed(encoded, secret);
}
export function readQuote(token: string): {
  shipment: string;
  amount: string;
  exp: number;
  input: BookingInput;
} {
  const [encoded, signature] = String(token).split(".");
  const secret = process.env.COURIER_SIGNING_SECRET;
  if (
    !secret ||
    !encoded ||
    !signature ||
    !validSignature(encoded, signature, secret)
  )
    throw new CourierError("Get a new delivery quote.");
  const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (data.exp < Date.now())
    throw new CourierError("Your quote expired. Get a new quote.");
  return data;
}
