import { GoogleSheetRow } from "./types";

export function mapGoogleSheetRow(values: string[]): GoogleSheetRow {
  return {
    orderId: values[0] ?? "",
    customerName: values[1] ?? "",
    mobileNumber: values[2] ?? "",
    email: values[3] ?? "",
    orderDate: values[4] ?? "",
    fulfillmentMethod: (values[5] as "Pickup" | "Delivery") ?? "Pickup",
    status: values[6] ?? "",
    courierPartner: values[7] ?? "",
    trackingNumber: values[8] ?? "",
    expectedDeliveryDate: values[9] ?? "",
    remarks: values[10] ?? "",
    lastUpdated: values[11] ?? "",
    syncStatus: values[12] ?? "",
    syncError: values[13] ?? "",
  };
}
