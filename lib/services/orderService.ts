import {
  getPaginatedOrders,
  findOrderByOrderId,
} from "@/lib/supabase/ordersRepository";

import { mapOrderResponse } from "@/lib/mappers/orderResponseMapper";
import { ApiError } from "@/lib/errors/ApiError";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export async function getOrders(
  page: number = DEFAULT_PAGE,
  pageSize: number = DEFAULT_PAGE_SIZE
) {
  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError("page must be a positive integer", 400);
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new ApiError("pageSize must be a positive integer", 400);
  }

  if (pageSize > MAX_PAGE_SIZE) {
    throw new ApiError(
      `pageSize cannot be greater than ${MAX_PAGE_SIZE}`,
      400
    );
  }

  const { orders, totalRecords } = await getPaginatedOrders(
    page,
    pageSize
  );

  const totalPages =
    totalRecords === 0
      ? 0
      : Math.ceil(totalRecords / pageSize);

  return {
    success: true,
    page,
    pageSize,
    totalRecords,
    totalPages,
    orders: orders.map(mapOrderResponse),
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
