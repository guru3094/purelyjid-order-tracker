import { supabase } from "./client";
import { DbOrder } from "@/lib/mappers/orderMapper";

export async function findOrderByOrderId(
  orderId: string
) {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      order_id,
      customer_name,
      mobile_number,
      email,
      order_date,
      fulfillment_method,
      tracking_number,
      expected_delivery_date,
      remarks,
      created_at,
      updated_at,
      order_status_master (
        status_code
      ),
      courier_master (
        courier_name
      )
    `)
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertOrder(order: DbOrder) {
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateOrder(
  orderId: string,
  order: Partial<DbOrder>
) {
  const { data, error } = await supabase
    .from("orders")
    .update(order)
    .eq("order_id", orderId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAllOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      order_id,
      customer_name,
      mobile_number,
      email,
      order_date,
      fulfillment_method,
      tracking_number,
      expected_delivery_date,
      remarks,
      created_at,
      updated_at,
      order_status_master (
        status_code
      ),
      courier_master (
        courier_name
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}
