import {
  delhiveryAction,
  refreshDelhivery,
} from "@/lib/courier/delhiveryWorkflow";
import { randomBytes } from "node:crypto";
import { accessHash } from "@/lib/courier/repository";
import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";

import { CourierError } from "@/lib/courier/borzo";
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
    let s = await shipment(b.id, b.access, staff);
    if (b.action === "view") {
      if (s.provider === "delhivery") s = await refreshDelhivery(s);
      return NextResponse.json(publicShipment(s), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (b.action === "share") {
      if (!staff) throw new CourierError("Unauthorized", 403);
      const token = randomBytes(32).toString("base64url");
      await saveShipment(s.id, { access_hash: accessHash(token) });
      return NextResponse.json({
        link: "/track-order#delivery=" + s.id + "." + token,
      });
    }
    if (s.provider === "delhivery") {
      await delhiveryAction(s, b, staff);
      return NextResponse.json(
        publicShipment(await shipment(s.id, b.access, staff)),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      staff &&
      b.action === "cancel" &&
      b.confirm === true &&
      !s.borzo_id &&
      s.state === "draft"
    ) {
      await saveShipment(s.id, { state: "cancelled" });
      return NextResponse.json(
        publicShipment(await shipment(s.id, undefined, true)),
      );
    }
    // Old private links cannot dispatch Borzo after switching to Delhivery.
    throw new CourierError(
      "This legacy Borzo request is no longer bookable. Ask PurelyJid for a new Delhivery request.",
      409,
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
