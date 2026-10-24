"use client";
import { catalogueDimensions, designPreview, type CatalogueSelection } from "@/lib/vinyl/catalogue-types";
import styles from "./catalogue.module.css";
export default function SelectedDesigns({ items, onChange, disabled = false }: { items: CatalogueSelection[]; onChange: (items: CatalogueSelection[]) => void; disabled?: boolean }) {
  function update(id: string, changes: Partial<CatalogueSelection>) { onChange(items.map(item => item.id === id ? { ...item, ...changes } : item)); }
  return <div className={styles.selections}>{items.map((item, i) => {
    const dimensions = catalogueDimensions(item);
    return <article className={styles.selection} key={item.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={designPreview(item.design)} alt="" width={80} height={80} />
      <div className={styles.selectionBody}><div className={styles.titleRow}><strong>{i+1}. {item.design.name} · {item.design.code}</strong><button type="button" disabled={disabled} onClick={() => onChange(items.filter(r => r.id !== item.id))}>Remove</button></div>
        <fieldset disabled={disabled} className={styles.fields}>
          <label>Set size by<select value={item.sizeBy} onChange={e => { const sizeBy = e.target.value as "width" | "height"; update(item.id, { sizeBy, size: item.size && Number(item.size) > 0 ? String(Number(dimensions[sizeBy].toFixed(4))) : "" }); }}><option value="width">Width</option><option value="height">Height</option></select></label>
          <label>Width (cm)<input type="number" min="0.1" max="29" step="any" readOnly={item.sizeBy !== "width"} value={item.sizeBy === "width" ? item.size : item.size ? Number(dimensions.width.toFixed(4)) : ""} onChange={e => update(item.id, { size: e.target.value })} /></label>
          <label>Height (cm)<input type="number" min="0.1" max="29" step="any" readOnly={item.sizeBy !== "height"} value={item.sizeBy === "height" ? item.size : item.size ? Number(dimensions.height.toFixed(4)) : ""} onChange={e => update(item.id, { size: e.target.value })} /></label>
          <label>Quantity<input type="number" min="1" max="100" step="1" value={item.quantity} onChange={e => update(item.id, { quantity: e.target.value })} /></label>
          <label>Vinyl colour<select value={item.color} onChange={e => update(item.id, { color: e.target.value })}><option value="">Select colour</option>{["Golden", "White", "Black", "Holographic"].map(c => <option key={c}>{c}</option>)}</select></label>
        </fieldset>
      </div>
    </article>;
  })}</div>;
}
