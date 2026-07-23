import {
  getPaginatedOrders,
  findOrderByOrderId,
} from "@/lib/supabase/ordersRepository";

import { mapOrderResponse } from "@/lib/mappers/orderResponseMapper";
import { ApiError } from "@/lib/errors/ApiError";
import { OrderSearchRequest } from "@/lib/models/OrderSearchRequest";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

export async function getOrders(
  request: Partial<OrderSearchRequest> = {}
) {
  const page = request.page ?? DEFAULT_PAGE;
  const pageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
  const searchTerm = request.q?.trim();

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

  if (searchTerm && searchTerm.length > MAX_SEARCH_LENGTH) {
    throw new ApiError(
      `q cannot be greater than ${MAX_SEARCH_LENGTH} characters`,
      400
    );
  }

  const orderSearchRequest: OrderSearchRequest = {
    page,
    pageSize,
    q: searchTerm || undefined,
    status: request.status,
    fulfillmentMethod: request.fulfillmentMethod,
    courier: request.courier,
    sortBy: request.sortBy,
    sortOrder: request.sortOrder,
  };

  const { orders, totalRecords } =
    await getPaginatedOrders(orderSearchRequest);

  const totalPages =
    totalRecords === 0
      ? 0
      : Math.ceil(totalRecords / pageSize);

  return {
    success: true,
    page,
    pageSize,
    query: searchTerm || null,
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
