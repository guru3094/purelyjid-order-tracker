const VALID_STATUS = [
  "ORDER_RECEIVED",
  "ORDER_CONFIRMED",
  "PREPARING",
  "PROCESSING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "READY_FOR_DISPATCH",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PICKED_UP",
  "COMPLETED",
  "CANCELLED",
];

export function validateStatus(status: string): void {
  if (!VALID_STATUS.includes(status)) {
    throw new Error(`Invalid order status: ${status}`);
  }
}
