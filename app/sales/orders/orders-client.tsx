"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StaffNav from "../staff-nav";
import CustomerWhatsAppDialog from "../customer-whatsapp-dialog";

type Order = {
  orderId: string;
  customerName: string;
  mobileNumber: string;
  orderDate: string;
  fulfillmentMethod: string;
  status: string;
  remarks?: string;
  productName?: string;
  productCost?: string;
  balanceToBePaid?: string;
  productCategory?: string;
};

type ArtistOrderStatus = {
  artistStatus: string;
  acceptedAt: string | null;
  sentAt: string | null;
  linkExpiresAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  ORDER_RECEIVED: "Order Received",
  PREPARING: "In Preparation",
  READY_FOR_PICKUP: "Ready for Pickup",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function enumLabel(value?: string) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusLabel(status: string) {
  return STATUS_LABELS[status.toUpperCase()] ?? enumLabel(status);
}

function statusClass(status: string) {
  const value = status.toUpperCase();
  if (value.includes("DELIVERED") || value.includes("COMPLETED")) return "order-status-badge status-success";
  if (value.includes("CANCELLED") || value.includes("FAILED") || value.includes("REJECTED")) return "order-status-badge status-danger";
  if (value.includes("SHIPPED") || value.includes("DELIVERING") || value.includes("TRANSIT")) return "order-status-badge status-info";
  if (value.includes("PREPARING") || value.includes("PROCESSING")) return "order-status-badge status-progress";
  return "order-status-badge status-pending";
}

function formatMoney(value?: string) {
  if (value === undefined || value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? `₹${number.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : `₹${value}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [category, setCategory] = useState("");
  const [artistSentOrders, setArtistSentOrders] = useState<Set<string>>(() => new Set());
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [artistMessages, setArtistMessages] = useState<Record<string, string>>({});
  const [artistStatuses, setArtistStatuses] = useState<Record<string, ArtistOrderStatus>>({});
  const [artistStatusError, setArtistStatusError] = useState("");
  const [customerWhatsAppOrderId, setCustomerWhatsAppOrderId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff/orders", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/staff-login";
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load orders.");
      setOrders(data.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  async function loadArtistStatuses() {
    try {
      const response = await fetch("/api/staff/artist-statuses", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/staff-login";
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load Artist acceptance statuses.");
      setArtistStatuses(data.statuses ?? {});
      setArtistStatusError("");
    } catch (e) {
      setArtistStatusError(e instanceof Error ? e.message : "Could not load Artist acceptance statuses.");
    }
  }

  useEffect(() => {
    void load();
    void loadArtistStatuses();
    const refresh = window.setInterval(() => { void loadArtistStatuses(); }, 30_000);
    const onFocus = () => { void loadArtistStatuses(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const recentAcceptances = useMemo(() =>
    Object.entries(artistStatuses)
      .filter(([, item]) => item.artistStatus === "ACCEPTED" && item.acceptedAt &&
        new Date(item.acceptedAt).getTime() > Date.now() - 48 * 60 * 60 * 1000)
      .sort((a, b) => new Date(b[1].acceptedAt ?? 0).getTime() - new Date(a[1].acceptedAt ?? 0).getTime())
      .slice(0, 3),
    [artistStatuses]
  );

  const statuses = useMemo(
    () => Array.from(new Set(orders.map((order) => order.status).filter(Boolean))).sort(),
    [orders]
  );

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const needle = q.trim().toLowerCase();
        const textMatch =
          !needle ||
          [order.orderId, order.customerName, order.mobileNumber, order.productName, order.remarks]
            .some((value) => String(value ?? "").toLowerCase().includes(needle));
        return (
          textMatch &&
          (!status || order.status === status) &&
          (!fulfillment || order.fulfillmentMethod === fulfillment) &&
          (!category || order.productCategory === category)
        );
      }),
    [orders, q, status, fulfillment, category]
  );

  async function sendToArtist(orderId: string) {
    if (sendingOrderId === orderId) return;
    setSendingOrderId(orderId);
    setArtistMessages((messages) => ({ ...messages, [orderId]: "" }));

    try {
      const response = await fetch("/api/whatsapp/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/staff-login";
        return;
      }

      if (response.status === 404 && data.code === "ARTIST_DETAILS_NOT_FOUND") {
        window.location.href = `/sales/artist-orders/create?orderId=${encodeURIComponent(orderId)}`;
        return;
      }

      if (!response.ok) throw new Error(data.error ?? "Could not prepare Artist WhatsApp message.");

      setArtistSentOrders((current) => {
        const next = new Set(current);
        next.add(orderId);
        return next;
      });
      setArtistMessages((messages) => ({ ...messages, [orderId]: "Artist acceptance link prepared." }));
      void loadArtistStatuses();
      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setArtistMessages((messages) => ({
        ...messages,
        [orderId]: e instanceof Error ? e.message : "Could not prepare Artist WhatsApp message.",
      }));
    } finally {
      setSendingOrderId(null);
    }
  }

  return (
    <div className="sales-shell">
      <StaffNav />
      <main className="sales-content">
        <section className="staff-card staff-orders-card">
          <div className="staff-orders-heading">
            <div>
              <span className="orders-kicker">Sales Management</span>
              <h1>Orders</h1>
              <p>Review customer orders, fulfilment and Artist allocation from one place.</p>
            </div>
            <button className="orders-refresh-button" onClick={() => { void load(); void loadArtistStatuses(); }} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Orders"}
            </button>
          </div>

          {recentAcceptances.length > 0 && (
            <div className="artist-accepted-notice" role="status">
              <strong>Recently accepted by Artist</strong>
              <span>{recentAcceptances.map(([id, item]) => `${id} (${formatDate(item.acceptedAt ?? undefined)})`).join(" · ")}</span>
            </div>
          )}

          <div className="staff-filters">
            <input
              placeholder="Search order, customer, mobile or product..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
            <select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>
              <option value="">All Fulfilment</option>
              <option value="Pickup">Pickup</option>
              <option value="Delivery">Delivery</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="Resin Art">Resin Art</option>
              <option value="Workshop">Workshop</option>
              <option value="Raw Materials">Raw Materials</option>
            </select>
          </div>

          <div className="orders-list-meta">
            <strong>{filtered.length}</strong>
            <span>of {orders.length} orders</span>
          </div>

          {error && <div className="staff-error">{error}</div>}
          {artistStatusError && <div className="staff-error">{artistStatusError}</div>}

          <div className="staff-table-wrap">
            <table className="staff-orders-table professional-orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Financials</th>
                  <th>Fulfilment</th>
                  <th>Status</th>
                  <th>Artist acceptance</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 ? (
                  <tr><td className="orders-empty-state" colSpan={9}>No orders match the selected filters.</td></tr>
                ) : (
                  filtered.map((order) => {
                    const artist = artistStatuses[order.orderId];
                    const accepted = artist?.artistStatus === "ACCEPTED";
                    const sent = artist?.artistStatus === "SENT" || artistSentOrders.has(order.orderId);
                    const activeLink = artist?.artistStatus === "SENT" &&
                      !!artist.linkExpiresAt && new Date(artist.linkExpiresAt).getTime() > Date.now();
                    const expiredLink = artist?.artistStatus === "SENT" &&
                      !!artist.linkExpiresAt && new Date(artist.linkExpiresAt).getTime() <= Date.now();
                    const sending = sendingOrderId === order.orderId;
                    return (
                      <tr key={order.orderId}>
                        <td className="order-primary-cell">
                          <strong>{order.orderId}</strong>
                          <span>{formatDate(order.orderDate)}</span>
                        </td>
                        <td>
                          <strong className="table-primary-text">{order.customerName}</strong>
                          <span className="table-secondary-text">{order.mobileNumber}</span>
                        </td>
                        <td>
                          <strong className="table-primary-text">{order.productName || "—"}</strong>
                          <span className="table-secondary-text">{enumLabel(order.productCategory)}</span>
                        </td>
                        <td>
                          <strong className="table-primary-text">{formatMoney(order.productCost)}</strong>
                          <span className="table-secondary-text">Balance {formatMoney(order.balanceToBePaid)}</span>
                        </td>
                        <td><span className="fulfilment-pill">{enumLabel(order.fulfillmentMethod)}</span></td>
                        <td><span className={statusClass(order.status)}>{statusLabel(order.status)}</span></td>
                        <td>
                          <span className={`artist-acceptance-badge ${accepted ? "artist-accepted" : sent ? "artist-waiting" : "artist-not-sent"}`}>
                            {accepted ? "Accepted" : expiredLink ? "Link expired" : sent ? "Awaiting Artist" : "Not sent"}
                          </span>
                          {accepted && artist.acceptedAt && <span className="artist-acceptance-date">{formatDate(artist.acceptedAt)}</span>}
                        </td>
                        <td className="order-remarks-cell">{order.remarks || "—"}</td>
                        <td className="artist-action-cell">
                          <div className="order-action-buttons">
                            <Link className="order-edit-button" href={`/sales/orders/${encodeURIComponent(order.orderId)}/edit`}>Edit Order</Link>
                            <button
                              type="button"
                              className="artist-send-button"
                              disabled={sending || activeLink}
                              onClick={() => sendToArtist(order.orderId)}
                            >
                              {sending ? "Preparing..." : activeLink ? "Awaiting Artist" : accepted ? "Send Again to Artist" : sent ? "Send New Link" : "Send to Artist"}
                            </button>
                            <button type="button" className="customer-send-button" onClick={() => setCustomerWhatsAppOrderId(order.orderId)}>WhatsApp Customer</button>
                            <Link className="cricut-generator-button" href={`/cricut_svg?orderId=${encodeURIComponent(order.orderId)}`}>SVG Generator</Link>
                          </div>
                          {artistMessages[order.orderId] && (
                            <div className="staff-whatsapp-note">{artistMessages[order.orderId]}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {customerWhatsAppOrderId && <CustomerWhatsAppDialog orderId={customerWhatsAppOrderId} onClose={() => setCustomerWhatsAppOrderId(null)} />}
    </div>
  );
}
