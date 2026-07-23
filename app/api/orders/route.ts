import { NextResponse } from "next/server";

import { getOrders } from "@/lib/services/orderService";
import { handleApiRequest } from "@/lib/api/handleApiRequest";
import { generateCorrelationId } from "@/lib/utils/generateCorrelationId";
import { runWithCorrelationId } from "@/lib/context/correlationContext";
import { logger } from "@/lib/logger/logger";

export async function GET() {
  const correlationId = generateCorrelationId();

  return runWithCorrelationId(
    correlationId,
    () =>
      handleApiRequest(async () => {
        logger.info(
          "ordersApi",
          "Fetching all orders"
        );

        const result = await getOrders();

        logger.info(
          "ordersApi",
          "Orders fetched successfully",
          {
            count: result.count,
          }
        );

        return NextResponse.json({
          correlationId,
          ...result,
        });
      })
  );
}
