import { NextRequest, NextResponse } from "next/server";

import { getOrders } from "@/lib/services/orderService";
import { handleApiRequest } from "@/lib/api/handleApiRequest";
import { generateCorrelationId } from "@/lib/utils/generateCorrelationId";
import { runWithCorrelationId } from "@/lib/context/correlationContext";
import { logger } from "@/lib/logger/logger";

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();

  return runWithCorrelationId(
    correlationId,
    () =>
      handleApiRequest(async () => {
        const searchParams = request.nextUrl.searchParams;

        const pageParam = searchParams.get("page");
        const pageSizeParam = searchParams.get("pageSize");

        const page = pageParam ? Number(pageParam) : 1;
        const pageSize = pageSizeParam ? Number(pageSizeParam) : 10;

        logger.info(
          "ordersApi",
          "Fetching paginated orders",
          {
            page,
            pageSize,
          }
        );

        const result = await getOrders(page, pageSize);

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
