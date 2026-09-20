import { after, NextRequest, NextResponse } from "next/server";

import { getOrders } from "@/lib/services/orderService";
import { handleApiRequest } from "@/lib/api/handleApiRequest";
import { generateCorrelationId } from "@/lib/utils/generateCorrelationId";
import { runWithCorrelationId } from "@/lib/context/correlationContext";
import { logger } from "@/lib/logger/logger";
import { OrderSearchRequest } from "@/lib/models/OrderSearchRequest";
import { createOrder } from "@/lib/services/createOrderService";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { syncGoogleSheet } from "@/lib/services/googleSheetSyncService";

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();

  return runWithCorrelationId(
    correlationId,
    () =>
      handleApiRequest(async () => {
        const searchParams = request.nextUrl.searchParams;

        const orderSearchRequest: Partial<OrderSearchRequest> = {
          page: Number(searchParams.get("page") ?? "1"),
          pageSize: Number(searchParams.get("pageSize") ?? "10"),
          q: searchParams.get("q") ?? undefined,
          status: searchParams.get("status") ?? undefined,
          fulfillmentMethod:
            searchParams.get("fulfillmentMethod") ?? undefined,
          courier: searchParams.get("courier") ?? undefined,
          sortBy: searchParams.get("sortBy") ?? undefined,
          sortOrder:
            (searchParams.get("sortOrder") as "asc" | "desc") ??
            undefined,
        };

        logger.info(
          "ordersApi",
          "Fetching orders",
          {
            request: orderSearchRequest,
          }
        );

        const result = await getOrders(orderSearchRequest);

        logger.info(
          "ordersApi",
          "Orders fetched successfully",
          {
            page: result.page,
            pageSize: result.pageSize,
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            returnedRecords: result.orders.length,
          }
        );

        return NextResponse.json({
          correlationId,
          ...result,
        });
      })
  );
}


export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();
  return runWithCorrelationId(correlationId, () => handleApiRequest(async () => {
    if (!(await isStaffAuthenticated())) {
      return NextResponse.json({ correlationId, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    logger.info("ordersApi", "Creating order in Google Sheet");
    const result = await createOrder(body);

    after(async () => {
      try {
        const syncResult = await syncGoogleSheet();
        logger.info("ordersApi", "Post-create Google Sheet sync completed", { orderId: result.orderId, syncResult });
      } catch (error) {
        logger.error("ordersApi", "Post-create Google Sheet sync failed", {
          orderId: result.orderId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    const artistNumber = (process.env.RESIN_ARTIST_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
    const artistMessage = [
      "Hi,", "",
      "PurelyJid has received a new order.",
      `Order ID: ${result.orderId}`,
      `Product: ${String(body.productDetails ?? "").trim()}`,
      "", "Please check the order details in the portal.", "", "– PurelyJid",
    ].join("\n");
    const artistWhatsAppUrl = artistNumber
      ? `https://wa.me/${artistNumber}?text=${encodeURIComponent(artistMessage)}`
      : null;

    logger.info("ordersApi", "Order created successfully", { orderId: result.orderId });
    return NextResponse.json({ correlationId, ...result, artistWhatsAppUrl }, { status: 201 });
  }));
}
