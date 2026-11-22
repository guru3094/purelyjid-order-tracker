"use client";

import { useEffect, useRef, useState } from "react";
import { hasProductPrice } from "@/lib/artist/product-review";
import styles from "./customer-whatsapp-dialog.module.css";

type Props = { orderId: string; onClose: () => void; onPrepared?: () => void; onOpened?: () => void };
type Draft = { productName: string; estimatedDeliveryDate: string };

export default function ArtistWhatsAppDialog({ orderId, onClose, onPrepared, onOpened }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDraft() {
      try {
        const response = await fetch(`/api/whatsapp/artist?orderId=${encodeURIComponent(orderId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          window.location.href = "/staff-login";
          return;
        }
        if (result.code === "ARTIST_DETAILS_NOT_FOUND") {
          window.location.href = `/sales/artist-orders/create?orderId=${encodeURIComponent(orderId)}`;
          return;
        }
        if (!response.ok) throw new Error(result.error || "Could not load the artist message.");
        setDraft({ productName: result.productName, estimatedDeliveryDate: result.estimatedDeliveryDate });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load the artist message.");
        }
      }
    }

    void loadDraft();
    return () => controller.abort();
  }, [orderId]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [busy, onClose]);

  async function prepare() {
    if (busy || !draft || url) return;
    const productName = draft.productName.trim();
    if (!productName || hasProductPrice(productName)) return;

    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/whatsapp/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          productNameOverride: productName,
          estimatedDeliveryDate: draft.estimatedDeliveryDate.trim(),
        }),
      });
      const result = await response.json();
      if (response.status === 401) {
        tab?.close();
        window.location.href = "/staff-login";
        return;
      }
      if (result.code === "ARTIST_DETAILS_NOT_FOUND") {
        tab?.close();
        window.location.href = `/sales/artist-orders/create?orderId=${encodeURIComponent(orderId)}`;
        return;
      }
      if (!response.ok || !result.whatsappUrl) throw new Error(result.error || "Could not prepare the artist message.");

      setUrl(result.whatsappUrl);
      onPrepared?.();
      if (tab) {
        tab.location.href = result.whatsappUrl;
        onOpened?.();
      }
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "Could not prepare the artist message.");
    } finally {
      setBusy(false);
    }
  }

  const containsPrice = draft && hasProductPrice(draft.productName);
  const canConfirm = draft?.productName.trim() && !containsPrice;

  return (
    <div className={styles.backdrop} onMouseDown={event => {
      if (event.currentTarget === event.target && !busy) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="artist-message-heading">
        <h2 id="artist-message-heading">Review artist message</h2>
        <p>Order <strong>{orderId}</strong>. Check the details below and remove prices, internal notes, and any other information the artist should not receive.</p>
        {!draft && !error && <p role="status">Loading artist details…</p>}
        {draft && (
          <>
            <label className={styles.productField}>
              Product description
              <textarea
                rows={5}
                maxLength={4000}
                value={draft.productName}
                disabled={busy || !!url}
                aria-invalid={!!containsPrice}
                aria-describedby={containsPrice ? "artist-price-warning" : undefined}
                onChange={event => setDraft({ ...draft, productName: event.target.value })}
              />
            </label>
            <label className={styles.dateField}>
              Estimated delivery date
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={draft.estimatedDeliveryDate}
                disabled={busy || !!url}
                onChange={event => setDraft({ ...draft, estimatedDeliveryDate: event.target.value })}
              />
              <small>Use YYYY-MM-DD or leave blank for “To be confirmed”.</small>
            </label>
          </>
        )}
        {containsPrice && <p id="artist-price-warning" className={styles.error} role="alert">Remove the detected price to continue.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {url ? (
          <p className={styles.note} role="status">
            Tap Send in WhatsApp to deliver the reviewed message.{" "}
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={onOpened}>Open WhatsApp</a>
          </p>
        ) : draft && (
          <div className={styles.choices}>
            <button type="button" disabled={busy || !canConfirm} onClick={() => void prepare()}>
              <strong>{busy ? "Preparing message…" : "Confirm & open WhatsApp"}</strong>
            </button>
          </div>
        )}
        <button ref={closeButton} type="button" className={styles.close} disabled={busy} onClick={onClose}>Close</button>
      </section>
    </div>
  );
}
