const VALID_STATUS = [
  "ORDER_RECEIVED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export function validateStatus(status: string): void {
  if (!VALID_STATUS.includes(status)) {
    throw new Error(`Invalid order status: ${status}`);
  }
}
