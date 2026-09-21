import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { createArtistAcceptanceLink } from "@/lib/services/artistOrderRequestService";

function formatDeliveryDate(value?: string | null) {
  if (!value) return "To be confirmed";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export async function POST(request: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId } = await request.json();
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }

    const artistNumber = (process.env.RESIN_ARTIST_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
    if (!artistNumber) {
      return NextResponse.json({ error: "RESIN_ARTIST_WHATSAPP_NUMBER is not configured." }, { status: 500 });
    }

    const { order, acceptanceUrl, expiresAt } = await createArtistAcceptanceLink(orderId.trim());
    const message = [
      "New PurelyJid Order",
      "",
      `Order ID: ${order.order_id}`,
      `Product: ${order.product_name}`,
      `Estimated Delivery Date: ${formatDeliveryDate(order.estimated_delivery_date)}`,
      "",
      "Are you interested in taking this order?",
      "",
      "Open this secure link to review and accept:",
      acceptanceUrl,
      "",
      "– PurelyJid",
    ].join("\n");

    return NextResponse.json({
      success: true,
      orderId: order.order_id,
      acceptanceUrl,
      expiresAt,
      whatsappUrl: `https://wa.me/${artistNumber}?text=${encodeURIComponent(message)}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare Artist WhatsApp message." },
      { status: 500 }
    );
  }
}
