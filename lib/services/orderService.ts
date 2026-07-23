import {
  getAllOrders,
  findOrderByOrderId,
} from "@/lib/supabase/ordersRepository";

import { mapOrderResponse } from "@/lib/mappers/orderResponseMapper";
import { ApiError } from "@/lib/errors/ApiError";

export async function getOrders() {
  const orders = await getAllOrders();

  return {
    success: true,
    count: orders?.length ?? 0,
    orders: (orders ?? []).map(mapOrderResponse),
  };
}

export async function getOrderById(orderId: string) {
  const order = await findOrderByOrderId(orderId);

  if (!order) {
    throw new ApiError("Order not found", 404);
  }

  return {
    success: true,
    order: mapOrderResponse(order),
  };
}
