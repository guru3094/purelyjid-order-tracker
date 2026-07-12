import { supabase } from "./client";

export async function findOrderByOrderId(orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function insertOrder(order: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateOrder(
  orderId: string,
  order: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("orders")
    .update(order)
    .eq("order_id", orderId)
    .select()
    .single();

  if (error) throw error;

  return data;
}
