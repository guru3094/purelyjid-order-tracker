import { redirect } from "next/navigation";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import StaffLoginForm from "./staff-login-form";
export default async function StaffLoginPage() {
  if (await isStaffAuthenticated()) redirect("/sales/create");
  return <StaffLoginForm />;
}
