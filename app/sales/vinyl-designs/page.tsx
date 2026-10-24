import { redirect } from "next/navigation";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import StaffNav from "@/app/sales/staff-nav";
import CatalogueManager from "./catalogue-manager";
export const metadata = { title: "Vinyl Design Catalogue", robots: { index: false, follow: false } };
export default async function Page() {
  if (!(await isStaffAuthenticated())) redirect("/staff-login?next=%2Fsales%2Fvinyl-designs");
  return <div className="sales-shell"><StaffNav /><main className="sales-content"><CatalogueManager /></main></div>;
}
