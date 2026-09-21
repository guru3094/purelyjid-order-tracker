"use client";
import { useEffect,useMemo,useState } from "react";
import StaffNav from "../staff-nav";
type Order={orderId:string;customerName:string;mobileNumber:string;orderDate:string;fulfillmentMethod:string;status:string;remarks?:string;productName?:string;productCost?:string;balanceToBePaid?:string;productCategory?:string};

export default function OrdersClient(){
 const[orders,setOrders]=useState<Order[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[q,setQ]=useState("");const[status,setStatus]=useState("");const[fulfillment,setFulfillment]=useState("");const[category,setCategory]=useState("");
 const[artistSentOrders,setArtistSentOrders]=useState<Set<string>>(()=>new Set());const[sendingOrderId,setSendingOrderId]=useState<string|null>(null);const[artistMessages,setArtistMessages]=useState<Record<string,string>>({});

 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/staff/orders",{cache:"no-store"});if(r.status===401){window.location.href="/staff-login";return;}const d=await r.json();if(!r.ok)throw new Error(d.error??"Could not load orders.");setOrders(d.orders??[]);}catch(e){setError(e instanceof Error?e.message:"Could not load orders.");}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 const statuses=useMemo(()=>Array.from(new Set(orders.map(o=>o.status).filter(Boolean))).sort(),[orders]);
 const filtered=useMemo(()=>orders.filter(o=>{const n=q.trim().toLowerCase();const text=!n||[o.orderId,o.customerName,o.mobileNumber,o.productName,o.remarks].some(v=>String(v??"").toLowerCase().includes(n));return text&&(!status||o.status===status)&&(!fulfillment||o.fulfillmentMethod===fulfillment)&&(!category||o.productCategory===category);}),[orders,q,status,fulfillment,category]);

 async function sendToArtist(orderId:string){
  if(sendingOrderId===orderId)return;
  setSendingOrderId(orderId);setArtistMessages(m=>({...m,[orderId]:""}));
  try{
   const r=await fetch("/api/whatsapp/artist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId})});
   const d=await r.json();
   if(r.status===401){window.location.href="/staff-login";return;}
   if(!r.ok)throw new Error(d.error??"Could not prepare Artist WhatsApp message.");
   setArtistSentOrders(current=>{const next=new Set(current);next.add(orderId);return next;});
   setArtistMessages(m=>({...m,[orderId]:"Acceptance link prepared."}));
   window.open(d.whatsappUrl,"_blank","noopener,noreferrer");
  }catch(e){setArtistMessages(m=>({...m,[orderId]:e instanceof Error?e.message:"Could not prepare Artist WhatsApp message."}));}
  finally{setSendingOrderId(null);}
 }

 return <div className="sales-shell"><StaffNav/><main className="sales-content"><section className="staff-card staff-orders-card"><div className="staff-orders-heading"><div><h1>Orders</h1><p>Live records read directly from Google Sheets.</p></div><button onClick={load} disabled={loading}>{loading?"Loading...":"Refresh"}</button></div>
 <div className="staff-filters"><input placeholder="Search order ID, customer, mobile, product, remarks" value={q} onChange={e=>setQ(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><select value={fulfillment} onChange={e=>setFulfillment(e.target.value)}><option value="">All fulfilment</option><option>Pickup</option><option>Delivery</option></select><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option><option>Resin Art</option><option>Workshop</option><option>Raw Materials</option></select></div>
 <p className="staff-results-count">{filtered.length} of {orders.length} orders</p>{error&&<div className="staff-error">{error}</div>}
 <div className="staff-table-wrap"><table className="staff-orders-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Product</th><th>Category</th><th>Amount</th><th>Balance</th><th>Fulfilment</th><th>Status</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>
 {!loading&&filtered.length===0?<tr><td colSpan={11}>No matching orders.</td></tr>:filtered.map(o=>{const sent=artistSentOrders.has(o.orderId);const sending=sendingOrderId===o.orderId;return <tr key={o.orderId}><td><strong>{o.orderId}</strong></td><td>{o.orderDate}</td><td>{o.customerName}<br/><small>{o.mobileNumber}</small></td><td>{o.productName||"—"}</td><td>{o.productCategory||"—"}</td><td>{o.productCost?`₹${o.productCost}`:"—"}</td><td>{o.balanceToBePaid?`₹${o.balanceToBePaid}`:"—"}</td><td>{o.fulfillmentMethod}</td><td>{o.status}</td><td>{o.remarks||"—"}</td><td><button type="button" disabled={sending} onClick={()=>sendToArtist(o.orderId)}>{sending?"Preparing...":sent?"Resend to Artist":"Send to Artist"}</button>{artistMessages[o.orderId]&&<div className="staff-whatsapp-note">{artistMessages[o.orderId]}</div>}</td></tr>;})}
 </tbody></table></div></section></main></div>;
}
