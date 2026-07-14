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

export async function processQueue() {

  while (!isQueueEmpty()) {

    // Get the next order from the queue
    const item = dequeue();

    if (!item) {
      continue;
    }

    /*
     * STEP 1
     * Find the Status UUID from order_status_master
     *
     * Example:
     * ORDER_RECEIVED
     * becomes
     * baed00df-30c0-4821-a3d8-fe40974fa1f0
     */
    const status = await getStatusByCode(item.order.status);

    /*
     * STEP 2
     * Find Courier UUID only for Delivery orders.
     *
     * Pickup orders do not require a courier.
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
     * Convert the application object
     * into the database object.
     */
    const dbOrder = mapOrderToDb(
      item.order,
      status.id,
      courierId
    );

    /*
     * STEP 4
     * Check whether the order already exists.
     */
    const existingOrder = await findOrderByOrderId(
      item.order.orderId
    );

    /*
     * STEP 5
     * Update existing order.
     */
    if (existingOrder) {

      await updateOrder(
        item.order.orderId,
        dbOrder
      );

    } else {

      /*
       * STEP 6
       * Insert new order.
       */
      await insertOrder(dbOrder);

    }

  }

}
