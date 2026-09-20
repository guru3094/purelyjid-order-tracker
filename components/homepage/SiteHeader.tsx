"use client";

import Link from "next/link";
import { useState } from "react";
import BrandLogo from "@/components/branding/BrandLogo";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-shell header-inner">
        <div className="header-brand">
          <BrandLogo priority />

          <span className="header-tagline">
            Resin Art • Supplies • Workshops
          </span>
        </div>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/#collections">Collections</Link>

          <Link href="/resin-art-consultation">
            Consultation
          </Link>

          <Link href="/our-story">Our Story</Link>

          <a
            href="https://www.instagram.com/purely_jid/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>

          <Link className="track-link" href="/track-order">
            Track Order
          </Link>
        </nav>

        <div className="mobile-header-actions">
          <Link className="mobile-track-link" href="/track-order">
            Track Order
          </Link>

          <button
            type="button"
            className={`mobile-menu-button ${
              menuOpen ? "mobile-menu-button-open" : ""
            }`}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <nav
        className={`mobile-nav ${
          menuOpen ? "mobile-nav-open" : ""
        }`}
        aria-label="Mobile navigation"
      >
        <Link href="/#collections" onClick={closeMenu}>
          Collections
        </Link>

        <Link
          href="/resin-art-consultation"
          onClick={closeMenu}
        >
          Resin Art Consultation
        </Link>

        <Link href="/our-story" onClick={closeMenu}>
          Our Story
        </Link>

        <a
          href="https://www.instagram.com/purely_jid/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          Instagram
        </a>
      </nav>
    </header>
  );
}