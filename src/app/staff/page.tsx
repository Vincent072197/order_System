import { requireStaff } from "@/src/lib/auth/server";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const staff = await requireStaff();

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">店家後台</h1>
        <LogoutButton />
      </div>
      <section className="bg-white rounded-2xl shadow p-6 space-y-2">
        <p>
          歡迎，<span className="font-semibold">{staff.displayName}</span>
        </p>
        <p className="text-sm text-gray-500">Email：{staff.email}</p>
        <p className="text-sm text-gray-500">角色：{staff.role}</p>
      </section>
      <p className="text-xs text-gray-400 mt-6">
        訂單列表 / 出單 / 儀表板將於下一階段加入。
      </p>
    </main>
  );
}
