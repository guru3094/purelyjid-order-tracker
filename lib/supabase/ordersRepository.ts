import { supabase } from "./client";
import { DbOrder } from "@/lib/mappers/orderMapper";

const ORDER_SELECT = `
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
`;

export async function findOrderByOrderId(
  orderId: string
) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
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
    .select(ORDER_SELECT)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function getPaginatedOrders(
  page: number,
  pageSize: number
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select(ORDER_SELECT, {
      count: "exact",
    })
    .order("created_at", {
      ascending: false,
    })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    orders: data ?? [],
    totalRecords: count ?? 0,
  };
}
