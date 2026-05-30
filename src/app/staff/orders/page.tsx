import Link from "next/link";
import { requireStaff } from "@/src/lib/auth/server";
import { listOrdersForRestaurant } from "@/src/lib/staffOrders";
import OrdersBoard from "./OrdersBoard";

// Server component (§4: requireStaff guard). Renders the first page of orders
// server-side, then OrdersBoard keeps it fresh by polling (§6: start with
// polling; upgrade to SSE in P5 only when the cost matters).
export const dynamic = "force-dynamic";

export default async function StaffOrdersPage() {
  const staff = await requireStaff();
  const initial = await listOrdersForRestaurant(staff.restaurantId);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">訂單列表</h1>
        <Link href="/staff" className="text-sm text-blue-600 hover:underline">
          ← 後台首頁
        </Link>
      </div>
      <OrdersBoard initial={initial} />
    </main>
  );
}
