import { redirect } from "next/navigation";
import { currentStaff } from "@/src/lib/auth/server";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage() {
  // If already authenticated, skip the form.
  const staff = await currentStaff();
  if (staff) redirect("/staff");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <LoginForm />
    </main>
  );
}
