import Link from "next/link";
import { requireStaff } from "@/src/lib/auth/server";
import { canEditMenu } from "@/src/lib/auth/api";
import { loadAdminMenu } from "@/src/lib/menuAdmin";
import CategoryAdmin from "./CategoryAdmin";
import MenuAdmin from "./MenuAdmin";

export const dynamic = "force-dynamic";

export default async function StaffMenuPage() {
  const staff = await requireStaff();

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">菜單管理</h1>
      <Link href="/staff" className="text-sm text-blue-600 hover:underline">
        ← 後台首頁
      </Link>
    </div>
  );

  // Page-level role guard mirrors the API guard (canEditMenu).
  if (!canEditMenu(staff.role)) {
    return (
      <main className="min-h-screen p-6 max-w-4xl mx-auto">
        {header}
        <p className="text-rose-600">
          你的角色（{staff.role}）沒有編輯菜單的權限，請聯絡 owner 或 manager。
        </p>
      </main>
    );
  }

  const menu = await loadAdminMenu(staff.restaurantId);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      {header}
      <div className="space-y-6">
        <CategoryAdmin categories={menu.categories} />
        <MenuAdmin initialMenu={menu} />
      </div>
    </main>
  );
}
