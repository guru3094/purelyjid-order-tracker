import { NextRequest, NextResponse } from "next/server";

import { getOrders } from "@/lib/services/orderService";
import { handleApiRequest } from "@/lib/api/handleApiRequest";
import { generateCorrelationId } from "@/lib/utils/generateCorrelationId";
import { runWithCorrelationId } from "@/lib/context/correlationContext";
import { logger } from "@/lib/logger/logger";
import { OrderSearchRequest } from "@/lib/models/OrderSearchRequest";

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
