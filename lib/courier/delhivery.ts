import { CourierError, type BookingInput } from "./borzo";
export const PUNE_PICKUP = {
  address:
    "Near 8-80 Garden, Sudarshan Chowk, Beside New Rohit Electronics, Pimple Gurav, Pune 411027",
  contact_person: { name: "PurelyJid", phone: "919518770073" },
  is_order_payment_here: false,
};
export type DelhiveryInput = BookingInput & {
  weight_grams: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  declared_value: number;
  invoice: string;
  ewaybill: string;
  pincode: string;
  city: string;
  region: string;
  shipping_mode: "Surface" | "Express";
  fragile: boolean;
};
const text = (x: unknown, max: number, min = 1) => {
  if (typeof x !== "string" || x.trim().length < min || x.trim().length > max)
    throw new CourierError("Check the parcel and delivery details.");
  return x.trim();
};
export function validateDelhivery(value: unknown): DelhiveryInput {
  const v = value as DelhiveryInput;
  if (!v) throw new CourierError("Delivery details required.");
  const n = (x: unknown, min: number, max: number) => {
    if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
      throw new CourierError(
        "Enter valid parcel weight, dimensions and value.",
      );
    return x;
  };
  const weight_grams = n(v.weight_grams, 1, 20000),
    length_cm = n(v.length_cm, 1, 100),
    width_cm = n(v.width_cm, 1, 100),
    height_cm = n(v.height_cm, 1, 100),
    declared_value = n(v.declared_value, 1, 49999.99);
  const p = v.points?.[1];
  if (!p) throw new CourierError("Delivery contact required.");
  const phone = String(p.contact_person?.phone || "").replace(/\D/g, "");
  if (!/^(91)?[6-9]\d{9}$/.test(phone))
    throw new CourierError("Enter a valid Indian delivery mobile number.");
  const pincode = text(v.pincode, 6, 6);
  if (!/^[1-9]\d{5}$/.test(pincode))
    throw new CourierError("Enter a six-digit Indian PIN code.");
  if (!["Surface", "Express"].includes(v.shipping_mode))
    throw new CourierError("Choose Surface or Express.");
  return {
    type: "standard",
    vehicle_type_id: 8,
    payment_method: "cash",
    matter: text(v.matter, 500),
    total_weight_kg: weight_grams / 1000,
    points: [
      PUNE_PICKUP,
      {
        address: text(p.address, 350, 10),
        contact_person: {
          name: text(p.contact_person?.name, 100),
          phone: phone.slice(-10),
        },
        is_order_payment_here: false,
      },
    ],
    weight_grams,
    length_cm,
    width_cm,
    height_cm,
    declared_value,
    invoice: text(v.invoice, 50),
    ewaybill: "",
    pincode,
    city: text(v.city, 100),
    region: text(v.region, 100),
    shipping_mode: v.shipping_mode,
    fragile: v.fragile === true,
  };
}
export function requireDispatchEnabled() {
  if (process.env.DELHIVERY_ENV === "staging") {
    if (!process.env.DELHIVERY_TEST_API_TOKEN)
      throw new CourierError(
        "Delhivery staging credentials are not configured.",
        503,
      );
  } else if (process.env.DELHIVERY_LIVE_ENABLED !== "true")
    throw new CourierError(
      "Live dispatch is disabled. Payment and acceptance can be recorded, but no shipment will be booked.",
      503,
    );
}
export async function delhivery(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    form?: boolean;
    query?: Record<string, string>;
    write?: boolean;
  } = {},
) {
  if (options.write) requireDispatchEnabled();
  const token =
    process.env.DELHIVERY_ENV === "staging"
      ? process.env.DELHIVERY_TEST_API_TOKEN
      : process.env.DELHIVERY_API_TOKEN;
  if (!token)
    throw new CourierError("Delhivery credentials are not configured.", 503);
  const root =
    process.env.DELHIVERY_ENV === "staging"
      ? "https://staging-express.delhivery.com"
      : "https://track.delhivery.com";
  const url = new URL(path, root);
  if (url.origin !== root) throw new CourierError("Invalid courier endpoint.");
  if (options.query) url.search = new URLSearchParams(options.query).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: "Token " + token,
        Accept: "application/json",
        ...(options.body
          ? {
              "Content-Type": options.form
                ? "application/x-www-form-urlencoded"
                : "application/json",
            }
          : {}),
      },
      body: options.body
        ? options.form
          ? new URLSearchParams({
              format: "json",
              data: JSON.stringify(options.body),
            }).toString()
          : JSON.stringify(options.body)
        : undefined,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new CourierError(
      "Delhivery did not return a confirmed response. Staff must reconcile any submitted booking before retrying.",
      502,
    );
  }
  if (!response.ok)
    throw new CourierError(
      "Delhivery could not confirm this request. Check serviceability, account access and balance.",
      502,
    );
  try {
    return await response.json();
  } catch {
    throw new CourierError(
      "Invalid Delhivery response. Reconcile submitted requests before retrying.",
      502,
    );
  }
}
export function prepaidServiceable(data: unknown, pin: string) {
  const d = data as {
    delivery_codes?: {
      postal_code?: {
        pin?: number | string;
        pre_paid?: string;
        remarks?: string;
      };
    }[];
  };
  return (
    d.delivery_codes?.some(
      (x) =>
        String(x.postal_code?.pin) === pin &&
        x.postal_code?.pre_paid === "Y" &&
        !String(x.postal_code?.remarks || "").trim(),
    ) === true
  );
}
export async function estimateDelivery(input: DelhiveryInput): Promise<string> {
  const service = await delhivery("/c/api/pin-codes/json/", {
    query: { filter_codes: input.pincode },
  });
  if (!prepaidServiceable(service, input.pincode))
    throw new CourierError(
      "This PIN code is not currently serviceable for prepaid delivery.",
    );
  const response = await delhivery("/api/kinko/v1/invoice/charges/.json", {
    query: {
      md: input.shipping_mode === "Surface" ? "S" : "E",
      ss: "Delivered",
      d_pin: input.pincode,
      o_pin: "411027",
      cgm: String(input.weight_grams),
      pt: "Pre-paid",
      l: String(input.length_cm),
      b: String(input.width_cm),
      h: String(input.height_cm),
      ipkg_type: "box",
    },
  });
  const rows = Array.isArray(response) ? response : [];
  const raw = rows[0]?.total_amount;
  if (
    raw === null ||
    raw === undefined ||
    raw === "" ||
    !Number.isFinite(Number(raw)) ||
    Number(raw) <= 0
  )
    throw new CourierError(
      "Delhivery did not return a valid delivery estimate.",
      502,
    );
  return Number(raw).toFixed(2);
}
export function manifestPayload(input: DelhiveryInput, reference: string) {
  return {
    pickup_location: {
      name: process.env.DELHIVERY_PICKUP_LOCATION || "PurelyJid",
    },
    shipments: [
      {
        name: input.points[1].contact_person.name,
        phone: input.points[1].contact_person.phone,
        add: input.points[1].address,
        pin: input.pincode,
        city: input.city,
        state: input.region,
        country: "India",
        order: reference,
        payment_mode: "Prepaid",
        cod_amount: "0",
        total_amount: input.declared_value,
        seller_inv: input.invoice,
        products_desc: input.matter,
        quantity: "1",
        weight: input.weight_grams,
        shipment_length: input.length_cm,
        shipment_width: input.width_cm,
        shipment_height: input.height_cm,
        shipping_mode: input.shipping_mode,
        fragile_shipment: input.fragile,
        return_name: "PurelyJid",
        return_add: PUNE_PICKUP.address,
        return_city: "Pune",
        return_state: "Maharashtra",
        return_pin: "411027",
        return_phone: "9518770073",
        return_country: "India",
      },
    ],
  };
}
export async function manifest(input: DelhiveryInput, reference: string) {
  const d = await delhivery("/api/cmu/create.json", {
    method: "POST",
    body: manifestPayload(input, reference),
    form: true,
    write: true,
  });
  const p = d.packages?.[0];
  if (
    d.success !== true ||
    d.packages?.length !== 1 ||
    p?.status !== "Success" ||
    !/^\d{8,30}$/.test(String(p.waybill || ""))
  )
    throw new CourierError(
      "Shipment creation was not confirmed. Staff must reconcile the order reference in Delhivery.",
      502,
    );
  return String(p.waybill);
}
export function validPickupDate(date: unknown, now = new Date()) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new CourierError("Choose a pickup date.");
  const dt = new Date(date + "T18:00:00+05:30");
  const todayIndia = new Date(now.getTime() + 19800000)
    .toISOString()
    .slice(0, 10);
  const daysAhead =
    (Date.parse(date + "T00:00:00Z") - Date.parse(todayIndia + "T00:00:00Z")) /
    86400000;
  if (
    !Number.isFinite(dt.getTime()) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date ||
    [0, 1].includes(new Date(date + "T00:00:00Z").getUTCDay()) ||
    dt.getTime() < now.getTime() + 60 * 60 * 1000 ||
    daysAhead > 7
  )
    throw new CourierError(
      "Choose Tuesday–Saturday, at least one hour before the 6 PM slot, within 7 days.",
    );
  return date;
}
export function trackingSnapshot(response: unknown, awb: string) {
  const d = response as {
    ShipmentData?: {
      Shipment?: {
        AWB?: string | number;
        Status?: {
          Status?: string;
          StatusDateTime?: string;
          StatusType?: string;
        };
      };
    }[];
  };
  const s = d.ShipmentData?.find(
    (x) => String(x.Shipment?.AWB) === awb,
  )?.Shipment;
  const status = s?.Status?.Status,
    at = Date.parse(s?.Status?.StatusDateTime || "");
  if (!status || !Number.isFinite(at))
    throw new CourierError("No confirmed tracking update is available.", 502);
  return {
    status:
      s?.Status?.StatusType === "RT" ? "Return to origin · " + status : status,
    at: new Date(at).toISOString(),
  };
}
