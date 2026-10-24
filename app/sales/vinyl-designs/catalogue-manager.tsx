"use client";
import { useEffect, useRef, useState } from "react";
import { DESIGN_CATEGORIES, designPreview, type CatalogueDesign, type CutOutline } from "@/lib/vinyl/catalogue-types";
import styles from "@/components/vinyl/catalogue.module.css";
export default function CatalogueManager() {
  const [designs, setDesigns] = useState<CatalogueDesign[]>([]), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [outline, setOutline] = useState<CutOutline | null>(null), [approved, setApproved] = useState(false), [revision, setRevision] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/staff/vinyl-designs", { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error); setDesigns(data.designs); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [revision]);
  async function submit(preview: boolean) {
    if (!form.current?.reportValidity()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = new FormData(form.current);
      data.set("action", preview ? "preview" : "save");
      data.set("approved", String(approved)); data.set("published", String(data.get("published") === "on"));
      if (!preview && (!outline || !approved)) throw Error("Preview the cut paths and approve them before saving.");
      const r = await fetch("/api/staff/vinyl-designs", { method: "POST", body: data });
      const result = await r.json(); if (!r.ok) throw Error(result.error);
      if (preview) { setOutline(result.outline); setApproved(false); }
      else { form.current.reset(); setOutline(null); setApproved(false); setRevision(n => n+1); setNotice("Design saved. Published designs are available to customers and in the SVG generator."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save design."); }
    finally { setBusy(false); }
  }
  async function toggle(design: CatalogueDesign) {
    if (!design.published && !window.confirm(`Confirm the cut paths for ${design.code} have been reviewed and approved for customer orders?`)) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/staff/vinyl-designs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: design.id, published: !design.published, approved: true }) });
      const data = await r.json(); if (!r.ok) throw Error(data.error);
      setRevision(n => n+1);
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(false); }
  }
  return <div className={styles.manager}><span className={styles.eyebrow}>PURELYJID · STAFF</span><h1>Vinyl Design Catalogue</h1><p className={styles.intro}>Upload artwork you are approved to offer. Use closed, filled vector paths; convert text, shapes and strokes to paths and flatten effects in your vector editor. Canva’s full library is not imported. The original eight-font flow is unchanged.</p>
    <form ref={form} className={styles.form} onSubmit={e => { e.preventDefault(); void submit(false); }}>
      <div className={styles.filters}><label>Design name<input name="name" required maxLength={100} placeholder="e.g. Ganesha outline" /></label><label>Unique design code<input name="code" required pattern="[A-Za-z0-9][A-Za-z0-9-]{1,29}" maxLength={30} placeholder="VD001" /></label><label>Category<select name="category">{DESIGN_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
      <label>Cut-ready SVG · under 500 KB<input name="svg" type="file" required accept=".svg,image/svg+xml" onChange={() => { setOutline(null); setApproved(false); }} /></label>
      <label>Thumbnail · optional PNG/JPG under 250 KB<input name="thumbnail" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" /><small>If omitted, the actual cut paths become the thumbnail.</small></label>
      <button type="button" disabled={busy} onClick={() => void submit(true)}>Preview cut paths</button>
      {outline && <><svg className={styles.cutPreview} viewBox={`${outline.bounds.x1} ${outline.bounds.y1} ${outline.bounds.x2-outline.bounds.x1} ${outline.bounds.y2-outline.bounds.y1}`} aria-label="Actual vector cut paths"><path d={outline.path} fill="#26343a" fillRule={outline.fillRule} /></svg><label className={styles.check}><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />I reviewed the cut paths and approve this artwork.</label></>}
      <label className={styles.check}><input type="checkbox" name="published" />Publish to customer catalogue and SVG generator</label><button type="submit" disabled={busy || !approved}>{busy ? "Working…" : "Save design"}</button>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <h2>Saved designs ({designs.length})</h2><p>Hidden designs are unavailable to new customer requests and new mat generation. Refresh the page to check recent changes.</p>
    <div className={styles.grid}>{designs.map(d => <article key={d.id} className={styles.card}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={designPreview(d)} alt={d.name} width={240} height={180} /><small>{d.code} · {d.category}</small><h3>{d.name}</h3><strong>{d.published ? "Published" : "Hidden"}</strong><a href={`/api/vinyl-designs/${d.id}/preview?cut=1`} target="_blank" rel="noopener noreferrer">View actual cut paths</a><button type="button" disabled={busy} onClick={() => void toggle(d)}>{d.published ? "Hide design" : "Publish design"}</button>
    </article>)}</div>
  </div>;
}
