"use client";
import { FormEvent,useMemo,useState } from "react";
import StaffNav from "../staff-nav";

const initial={
  customerName:"",mobileNumber:"",email:"",productDetails:"",remarks:"",
  productCost:"",advancePaid:"",fulfillmentMethod:"Pickup",productCategory:"Resin Art",
  artistRequirements:"",artistCost:"",artistAdvance:"",artistEstimatedDeliveryDate:"",artistComments:""
};

type Created={orderId:string;customerName:string;mobileNumber:string;productDetails:string;productCost:number;advancePaid:number;balance:number;fulfillmentMethod:string};
const money=(n:number)=>n.toLocaleString("en-IN",{maximumFractionDigits:2});

function customerWhatsAppUrl(o:Created){
  const phone=`91${o.mobileNumber.replace(/\D/g,"").slice(-10)}`;
  const message=[`Hi ${o.customerName},`,"","Thank you for choosing PurelyJid! Your order has been received successfully.","",`Order ID: ${o.orderId}`,`Order: ${o.productDetails}`,`Order Amount: ₹${money(o.productCost)}`,`Advance Paid: ₹${money(o.advancePaid)}`,`Balance: ₹${money(o.balance)}`,`Fulfilment: ${o.fulfillmentMethod}`,"",`Track your order using Order ID ${o.orderId} at purelyjid.in/track-order`,"","– PurelyJid"].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function CreateSaleForm(){
 const[form,setForm]=useState(initial);const[loading,setLoading]=useState(false);const[artistSending,setArtistSending]=useState(false);const[error,setError]=useState("");const[successMessage,setSuccessMessage]=useState("");const[created,setCreated]=useState<Created|null>(null);
 const balance=useMemo(()=>Math.max(0,Number(form.productCost||0)-Number(form.advancePaid||0)),[form.productCost,form.advancePaid]);
 const artistBalance=useMemo(()=>Math.max(0,Number(form.artistCost||0)-Number(form.artistAdvance||0)),[form.artistCost,form.artistAdvance]);
 function change(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>){setForm({...form,[e.target.name]:e.target.value});}

 async function submit(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");setSuccessMessage("");
  const submitted={...form};
  try{
   const artistCost=Number(submitted.artistCost||0),artistAdvance=Number(submitted.artistAdvance||0);
   if(artistAdvance>artistCost){setError("Artist advance cannot be greater than Artist cost.");return;}
   const body={
    customerName:submitted.customerName,mobileNumber:submitted.mobileNumber,email:submitted.email,
    productDetails:submitted.productDetails,remarks:submitted.remarks,productCost:submitted.productCost,
    advancePaid:submitted.advancePaid,fulfillmentMethod:submitted.fulfillmentMethod,productCategory:submitted.productCategory,
    artistDetails:{
      requirements:submitted.artistRequirements,artistCost,artistAdvance,
      estimatedDeliveryDate:submitted.artistEstimatedDeliveryDate,comments:submitted.artistComments
    }
   };
   const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const d=await r.json();
   if(r.status===401){window.location.href="/staff-login";return;}
   if(!r.ok){setError(d.error??d.message??"Order creation failed.");return;}
   setCreated({orderId:d.orderId,customerName:submitted.customerName,mobileNumber:submitted.mobileNumber,productDetails:submitted.productDetails,productCost:Number(submitted.productCost),advancePaid:Number(submitted.advancePaid),balance:Number(d.balance),fulfillmentMethod:submitted.fulfillmentMethod});
   setForm(initial);
  }catch{setError("Could not create the order. Please try again.");}finally{setLoading(false);}
 }

 async function sendWhatsAppToArtist(orderId:string){
  setArtistSending(true);setError("");setSuccessMessage("");
  try{
   const r=await fetch("/api/whatsapp/artist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId})});
   const d=await r.json();
   if(r.status===401){window.location.href="/staff-login";return;}
   if(!r.ok)throw new Error(d.error??"Could not prepare Artist WhatsApp message.");
   setSuccessMessage("Artist acceptance link prepared. Send the WhatsApp message to the Resin Artist.");
   window.open(d.whatsappUrl,"_blank","noopener,noreferrer");
  }catch(e){setError(e instanceof Error?e.message:"Could not prepare Artist WhatsApp message.");}
  finally{setArtistSending(false);}
 }

 return <div className="sales-shell"><StaffNav/><main className="sales-content"><section className="staff-card"><h1>Create Sale</h1><p>Creates the order in Google Sheets and automatically starts the existing sync to Supabase.</p>
 {created?<div className="staff-order-success"><div className="staff-success">Order <strong>{created.orderId}</strong> created successfully.</div><div className="staff-order-summary"><p><strong>Customer:</strong> {created.customerName}</p><p><strong>Order Amount:</strong> ₹{money(created.productCost)}</p><p><strong>Advance Paid:</strong> ₹{money(created.advancePaid)}</p><p><strong>Balance:</strong> ₹{money(created.balance)}</p><p><strong>Fulfilment:</strong> {created.fulfillmentMethod}</p></div>
 <div className="staff-success-actions"><button type="button" onClick={()=>window.open(customerWhatsAppUrl(created),"_blank","noopener,noreferrer")}>WhatsApp Customer</button><button type="button" disabled={artistSending} onClick={()=>sendWhatsAppToArtist(created.orderId)}>{artistSending?"Preparing...":"WhatsApp Resin Artist"}</button><button type="button" className="staff-secondary" onClick={()=>{setCreated(null);setSuccessMessage("");setError("");}}>Create Another Order</button></div>{successMessage&&<p className="staff-whatsapp-note">{successMessage}</p>}{error&&<div className="staff-error">{error}</div>}</div>:
 <form onSubmit={submit} className="staff-grid">
 <label>Customer Name *<input name="customerName" value={form.customerName} onChange={change} required/></label>
 <label>Mobile Number *<input name="mobileNumber" inputMode="numeric" maxLength={10} value={form.mobileNumber} onChange={change} required/></label>
 <label>Email<input name="email" type="email" value={form.email} onChange={change}/></label>
 <label>Product Category *<select name="productCategory" value={form.productCategory} onChange={change}><option>Resin Art</option><option>Workshop</option><option>Raw Materials</option></select></label>
 <label className="staff-full">Product / Order Details *<textarea name="productDetails" rows={4} value={form.productDetails} onChange={change} required/></label>
 <label className="staff-full">Remarks<textarea name="remarks" rows={3} value={form.remarks} onChange={change} placeholder="Optional remarks for this order"/></label>
 <label>Product Cost (₹) *<input name="productCost" type="number" min="1" step="0.01" value={form.productCost} onChange={change} required/></label>
 <label>Advance Paid (₹) *<input name="advancePaid" type="number" min="0" step="0.01" value={form.advancePaid} onChange={change} required/></label>
 <label>Balance (₹)<input value={balance} readOnly/></label>
 <label>Fulfilment Method *<select name="fulfillmentMethod" value={form.fulfillmentMethod} onChange={change}><option>Pickup</option><option>Delivery</option></select></label>
 <div className="staff-full"><h2>Resin Artist Details</h2><p>These fields are stored separately and are not added to the main Orders Google Sheet.</p></div>
 <label className="staff-full">Requirements<textarea name="artistRequirements" rows={3} value={form.artistRequirements} onChange={change}/></label>
 <label>Artist Cost (₹)<input name="artistCost" type="number" min="0" step="0.01" value={form.artistCost} onChange={change}/></label>
 <label>Artist Advance (₹)<input name="artistAdvance" type="number" min="0" step="0.01" value={form.artistAdvance} onChange={change}/></label>
 <label>Artist Balance (₹)<input value={artistBalance} readOnly/></label>
 <label>Estimated Delivery Date<input name="artistEstimatedDeliveryDate" type="date" value={form.artistEstimatedDeliveryDate} onChange={change}/></label>
 <label className="staff-full">Artist Comments<textarea name="artistComments" rows={3} value={form.artistComments} onChange={change}/></label>
 {error&&<div className="staff-full staff-error">{error}</div>}<div className="staff-full staff-actions"><button disabled={loading}>{loading?"Creating Order...":"Create Order"}</button></div></form>}
 </section></main></div>;
}
