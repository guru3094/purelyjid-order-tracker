import { NextRequest, NextResponse } from "next/server";
import { acceptArtistRequest } from "@/lib/services/artistOrderRequestService";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Acceptance token is required." }, { status: 400 });
    }
    const result = await acceptArtistRequest(token);
    return NextResponse.json({
      success: true,
      duplicate: result.duplicate,
      orderId: result.order.order_id,
      message: "Thank you for accepting the order! 😊 All order details have been updated in the Resin Artist Order Sheet. Please check the sheet for the complete details.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not accept this order." },
      { status: 400 }
    );
  }
}
