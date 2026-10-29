import { OrderResponse } from "@/lib/types/orderApi";

export interface TrackOrderApiResponse {
  correlationId: string;
  success: boolean;
  order: OrderResponse | null;
  courier?: {orderRef:string;status:string;updatedAt:string}|null;
}
