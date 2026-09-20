import { ApiError } from "@/lib/errors/ApiError";
import { mapOrderResponse } from "@/lib/mappers/orderResponseMapper";
import { findOrderForCustomer } from "@/lib/supabase/ordersRepository";

const MIN_ORDER_ID_LENGTH = 3;
const MAX_ORDER_ID_LENGTH = 100;

const MIN_MOBILE_LENGTH = 8;
const MAX_MOBILE_LENGTH = 15;

function normalizeMobileNumber(
  mobileNumber: string
): string {
  return mobileNumber.replace(/\D/g, "");
}

export async function trackCustomerOrder(
  orderId: string,
  mobileNumber: string
) {
  const normalizedOrderId = orderId.trim();

  const normalizedMobileNumber =
    normalizeMobileNumber(mobileNumber);

  if (!normalizedOrderId) {
    throw new ApiError(
      "Order ID is required",
      400
    );
  }

  if (
    normalizedOrderId.length < MIN_ORDER_ID_LENGTH ||
    normalizedOrderId.length > MAX_ORDER_ID_LENGTH
  ) {
    throw new ApiError(
      "Please enter a valid Order ID",
      400
    );
  }

  if (!normalizedMobileNumber) {
    throw new ApiError(
      "Mobile number is required",
      400
    );
  }

  if (
    normalizedMobileNumber.length < MIN_MOBILE_LENGTH ||
    normalizedMobileNumber.length > MAX_MOBILE_LENGTH
  ) {
    throw new ApiError(
      "Please enter a valid mobile number",
      400
    );
  }

  const order = await findOrderForCustomer(
    normalizedOrderId,
    normalizedMobileNumber
  );

  if (!order) {
    throw new ApiError(
      "We could not find an order matching the provided details.",
      404
    );
  }

  return {
    success: true,
    order: mapOrderResponse(order),
  };
}
