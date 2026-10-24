"use client";
import { useEffect, useState } from "react";
import { DESIGN_CATEGORIES, designPreview, type CatalogueDesign } from "@/lib/vinyl/catalogue-types";
import styles from "./catalogue.module.css";
export default function DesignCatalogue({ onSelect, disabled = false }: { onSelect: (design: CatalogueDesign) => void; disabled?: boolean }) {
  const [designs, setDesigns] = useState<CatalogueDesign[]>([]);
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vinyl-designs", { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load designs.");
      setDesigns(result.designs); setError(""); setLoading(false);
    }).catch(cause => { if (!controller.signal.aborted) { setError(cause.message); setLoading(false); } });
    return () => controller.abort();
  }, [attempt]);
  const shown = designs.filter(d => (!category || d.category === category) && `${d.name} ${d.code} ${d.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className={styles.catalogue}>
    <div className={styles.filters}><label>Search designs<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ganesha, wedding, design code…" type="search" /></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{DESIGN_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
    {loading && <p role="status">Loading approved designs…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setAttempt(n => n+1); }}>Try again</button></div>}
    {!loading && !error && !shown.length && <p className={styles.empty}>{designs.length ? "No matching designs. Try another search or category." : "Our approved design collection is being prepared. You can still order with our eight fonts or upload your own image below."}</p>}
    <div className={styles.grid}>{shown.map(design => <article key={design.id} className={styles.card}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" src={designPreview(design)} alt={design.name} width={240} height={180} />
      <small>{design.category} · {design.code}</small><h3>{design.name}</h3>
      <button type="button" disabled={disabled} onClick={() => onSelect(design)}>+ Select design</button>
    </article>)}</div>
  </div>;
}
