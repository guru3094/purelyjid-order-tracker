import {
  dequeue,
  isQueueEmpty,
} from "./writeQueue";

import {
  findOrderByOrderId,
  insertOrder,
  updateOrder,
} from "@/lib/supabase/ordersRepository";

import { mapOrderToDb } from "@/lib/mappers/orderMapper";

import { getStatusByCode } from "@/lib/supabase/statusRepository";
import { getCourierByName } from "@/lib/supabase/courierRepository";

import { saveFailedOrder } from "@/lib/supabase/failedOrdersRepository";

export interface QueueProcessingResult {
  inserted: number;
  updated: number;
  failed: number;
}

export async function processQueue(): Promise<QueueProcessingResult> {
  const result: QueueProcessingResult = {
    inserted: 0,
    updated: 0,
    failed: 0,
  };

  while (!isQueueEmpty()) {
    const item = dequeue();

    if (!item) {
      continue;
    }

    try {
      /*
       * STEP 1
       * Resolve Status UUID
       */
      const status = await getStatusByCode(item.order.status);

      if (!status) {
        throw new Error(
          `Status '${item.order.status}' not found in order_status_master`
        );
      }

      /*
       * STEP 2
       * Resolve Courier UUID
       */
      let courierId: string | null = null;

      if (
        item.order.fulfillmentMethod === "Delivery" &&
        item.order.courierPartner
      ) {
        const courier = await getCourierByName(
          item.order.courierPartner
        );

        if (!courier) {
          throw new Error(
            `Courier '${item.order.courierPartner}' not found in courier_master`
          );
        }

        courierId = courier.id;
      }

      /*
       * STEP 3
       * Map application model to database model
       */
      const dbOrder = mapOrderToDb(
        item.order,
        status.id,
        courierId
      );

      /*
       * STEP 4
       * Check if the order already exists
       */
      const existingOrder = await findOrderByOrderId(
        item.order.orderId
      );

      /*
       * STEP 5
       * Update existing order or insert a new one
       */
      if (existingOrder) {
        await updateOrder(
          item.order.orderId,
          dbOrder
        );

        result.updated++;
      } else {
        await insertOrder(dbOrder);

        result.inserted++;
      }
    } catch (error) {
      result.failed++;

      await saveFailedOrder({
        order_id: item.order.orderId,
        failure_source: "GOOGLE_SHEETS",
        payload: item.order,
        error_message:
          error instanceof Error
            ? error.message
            : "Unknown Error",
        retry_count: item.retryCount,
        status: "PENDING",
      });

      console.error(
        `Queue processing failed for Order ${item.order.orderId}`,
        error
      );
    }
  }

  return result;
}
