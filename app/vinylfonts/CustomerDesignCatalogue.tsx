"use client";
import { useState } from "react";
import DesignCatalogue from "@/components/vinyl/DesignCatalogue";
import SelectedDesigns from "@/components/vinyl/SelectedDesigns";
import { designPreview, validateSelection, type CatalogueSelection } from "@/lib/vinyl/catalogue-types";
import styles from "@/components/vinyl/catalogue.module.css";
export default function CustomerDesignCatalogue() {
  const [items, setItems] = useState<CatalogueSelection[]>([]), [error, setError] = useState("");
  function send() {
    try {
      if (!items.length) throw new Error("Select at least one design.");
      const details = items.map((item, i) => {
        const size = validateSelection(item);
        if (!item.color) throw new Error(`${item.design.code}: choose a vinyl colour.`);
        return `${i+1}. ${item.design.code} — ${item.design.name}\nWidth: ${Number(size.width.toFixed(4))} cm\nHeight: ${Number(size.height.toFixed(4))} cm\nColour: ${item.color}\nQuantity: ${item.quantity}\nPreview: ${new URL(designPreview(item.design), window.location.origin)}`;
      });
      const text = `Hi PurelyJid, I would like these custom vinyl designs.\n\n${details.join("\n\n")}\n\nPlease confirm availability and price.`;
      window.open(`https://wa.me/919518770073?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your selections."); }
  }
  return <section id="browse-designs" className={styles.section} aria-labelledby="browse-designs-heading"><div className={styles.inner}>
    <span className={styles.eyebrow}>ARTWORK, READY FOR YOUR STORY</span><h2 id="browse-designs-heading">Browse Designs</h2><p className={styles.intro}>Choose approved Ganesha artwork, religious symbols, wedding motifs and decorative designs. Set the width or height and we’ll keep the proportions. Each selection can have its own size, colour and quantity.</p>
    <DesignCatalogue onSelect={design => setItems(all => [...all, { id: crypto.randomUUID(), design, sizeBy: "width", size: "5", quantity: "1", color: "" }])} />
    {items.length > 0 && <><h3>Your selected designs ({items.length})</h3><SelectedDesigns items={items} onChange={setItems} /><button type="button" className={styles.primary} onClick={send}>Send Designs on WhatsApp</button></>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div></section>;
}
