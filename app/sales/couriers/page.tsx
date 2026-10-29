import { redirect } from "next/navigation";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import CouriersClient from "./couriers-client";
export default async function Page() {
  if (!(await isStaffAuthenticated())) redirect("/staff-login");
  return <CouriersClient />;
}
