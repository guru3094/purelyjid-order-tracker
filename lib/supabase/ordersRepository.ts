import { supabase } from "./client";
import { DbOrder } from "@/lib/mappers/orderMapper";
import { OrderSearchRequest } from "@/lib/models/OrderSearchRequest";

const BASE_ORDER_FIELDS = `
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
  updated_at
`;

const ORDER_SELECT = `
  ${BASE_ORDER_FIELDS},
  order_status_master (
    status_code
  ),
  courier_master (
    courier_name
  )
`;

function buildOrderSelect(
  status?: string,
  courier?: string
): string {
  const statusRelation = status
    ? `order_status_master:order_status_master!inner (
        status_code
      )`
    : `order_status_master (
        status_code
      )`;

  const courierRelation = courier
    ? `courier_master:courier_master!inner (
        courier_name
      )`
    : `courier_master (
        courier_name
      )`;

  return `
    ${BASE_ORDER_FIELDS},
    ${statusRelation},
    ${courierRelation}
  `;
}

export async function findOrderByOrderId(orderId: string) {
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

export async function getPaginatedOrders({
  page,
  pageSize,
  q,
  status,
  fulfillmentMethod,
  courier,
}: OrderSearchRequest) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const selectQuery = buildOrderSelect(status, courier);

  let query = supabase
    .from("orders")
    .select(selectQuery, {
      count: "exact",
    });

  if (q) {
    query = query.or(
      [
        `order_id.ilike.%${q}%`,
        `customer_name.ilike.%${q}%`,
        `mobile_number.ilike.%${q}%`,
        `email.ilike.%${q}%`,
      ].join(",")
    );
  }

  if (status) {
    query = query.ilike(
      "order_status_master.status_code",
      status
    );
  }

  if (fulfillmentMethod) {
    query = query.ilike(
      "fulfillment_method",
      fulfillmentMethod
    );
  }

  if (courier) {
    query = query.ilike(
      "courier_master.courier_name",
      courier
    );
  }

  const { data, error, count } = await query
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
