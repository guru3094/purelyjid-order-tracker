import type { InvoiceSnapshot } from "./links";

function formatMoney(value: number) { return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

export function customerWhatsAppMessage(snapshot: InvoiceSnapshot, invoiceUrl: string, productCategory?: string): string {
  const omitTracking = ["workshop", "raw materials"].includes(productCategory?.trim().toLowerCase() ?? "");
  return [
    `Hi ${snapshot.customerName},`, "",
    "Thank you for choosing PurelyJid! Your order has been received successfully.", "",
    `Order ID: ${snapshot.orderId}`,
    ...(snapshot.mode === "invoice" ? [
      `Order: ${snapshot.productName}`,
      `Order Amount: ${formatMoney(snapshot.productCost!)}`,
      `Advance Paid: ${formatMoney(snapshot.advancePaid)}`,
      `Balance: ${formatMoney(snapshot.balance!)}`,
      `Fulfilment: ${snapshot.fulfillmentMethod}`,
    ] : [
      `Advance Paid: ${formatMoney(snapshot.advancePaid)}`,
      "Product selection: Pending",
    ]),
    "", `${snapshot.mode === "invoice" ? "Invoice" : "Advance receipt"} PDF: ${invoiceUrl}`, "",
    ...(!omitTracking ? [`Track your order using Order ID ${snapshot.orderId} at purelyjid.in/track-order`, ""] : []),
    "– PurelyJid",
  ].join("\n");
}
