import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { ArtistProductReviewRequired } from "@/lib/artist/product-review";
import { createArtistAcceptanceLink, getArtistMessageDraft } from "@/lib/services/artistOrderRequestService";

function formatDeliveryDate(value?: string | null) {
  if (!value) return "To be confirmed";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export async function GET(request: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) return NextResponse.json({ error: "orderId is required." }, { status: 400 });

  try {
    const draft = await getArtistMessageDraft(orderId);
    if (!draft) {
      return NextResponse.json({ error: "Artist details were not found for this order.", code: "ARTIST_DETAILS_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({
      productName: draft.product_name,
      estimatedDeliveryDate: draft.estimated_delivery_date ?? "",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load Artist details." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId, productNameOverride, estimatedDeliveryDate } = await request.json();
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }

    if (typeof productNameOverride !== "string" || !productNameOverride.trim() || productNameOverride.trim().length > 4000) {
      return NextResponse.json({ error: "Review the artist-facing product description before continuing." }, { status: 400 });
    }
    if (estimatedDeliveryDate !== undefined && estimatedDeliveryDate !== "") {
      const isDate = typeof estimatedDeliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(estimatedDeliveryDate);
      const date = new Date(isDate ? estimatedDeliveryDate : NaN);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== estimatedDeliveryDate) {
        return NextResponse.json({ error: "Enter a valid estimated delivery date." }, { status: 400 });
      }
    }

    const artistNumber = (process.env.RESIN_ARTIST_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
    if (!artistNumber) {
      return NextResponse.json({ error: "RESIN_ARTIST_WHATSAPP_NUMBER is not configured." }, { status: 500 });
    }

    const { order, acceptanceUrl, expiresAt } = await createArtistAcceptanceLink(orderId.trim(), { productNameOverride, estimatedDeliveryDate });
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
    if (error instanceof ArtistProductReviewRequired) return NextResponse.json({ error: error.message, code: "ARTIST_PRODUCT_REVIEW_REQUIRED", productName: error.productName }, { status: 409 });
    const message = error instanceof Error ? error.message : "Could not prepare Artist WhatsApp message.";
    if (message === "Artist details were not found for this order.") {
      return NextResponse.json(
        { error: message, code: "ARTIST_DETAILS_NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
