"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";

// Show through 16 November in India, independently of build time or visitor timezone.
const expiresAt = Date.parse("2026-11-17T00:00:00+05:30");
const isActive = () => Date.now() < expiresAt;
const serverSnapshot = () => false;

function subscribe(onChange: () => void) {
  const interval = window.setInterval(onChange, 60_000);
  const timeout = window.setTimeout(onChange, Math.min(Math.max(0, expiresAt - Date.now()), 2_147_483_647));
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(interval);
    window.clearTimeout(timeout);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export default function DiwaliBanner() {
  const visible = useSyncExternalStore(subscribe, isActive, serverSnapshot);
  if (!visible) return null;

  return (
    <section aria-label="Diwali greetings from PurelyJid">
      <Image
        src="/diwali-banner.webp"
        alt="PurelyJid wishes you a Happy Diwali. May your celebrations glow with love, light and creativity."
        width={2172}
        height={724}
        sizes="100vw"
        loading="eager"
        style={{ display: "block", width: "100%", height: "auto" }}
      />
    </section>
  );
}
