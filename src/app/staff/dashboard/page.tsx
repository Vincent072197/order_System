import Link from "next/link";
import { requireStaff } from "@/src/lib/auth/server";
import { getDashboardStats } from "@/src/lib/dashboard";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

// Reports are owner/manager only (same set as menu editing).
const REPORT_ROLES = ["owner", "manager"];

export default async function DashboardPage() {
  const staff = await requireStaff();

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">營收儀表板</h1>
      <div className="flex items-center gap-3">
        <RefreshButton />
        <Link href="/staff" className="text-sm text-blue-600 hover:underline">
          ← 後台首頁
        </Link>
      </div>
    </div>
  );

  if (!REPORT_ROLES.includes(staff.role)) {
    return (
      <main className="min-h-screen p-6 max-w-4xl mx-auto">
        {header}
        <p className="text-rose-600">
          你的角色（{staff.role}）沒有查看營收的權限。
        </p>
      </main>
    );
  }

  const stats = await getDashboardStats(staff.restaurantId);
  const maxHourRevenue = Math.max(1, ...stats.byHour.map((h) => h.revenue));
  const hasData = stats.todayOrders > 0;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      {header}
      <p className="text-xs text-gray-400 mb-4">
        統計區間：今日（Asia/Taipei），不含已取消訂單。
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card label="今日營收" value={`NT$ ${stats.todayRevenue.toLocaleString()}`} />
        <Card label="今日訂單" value={String(stats.todayOrders)} />
        <Card
          label="平均出餐時間"
          value={
            stats.avgPrepMinutes == null
              ? "—"
              : `${stats.avgPrepMinutes} 分`
          }
        />
      </div>

      {!hasData && (
        <p className="text-gray-500 bg-white rounded-2xl shadow p-6 text-center">
          今日尚無訂單資料。送幾筆訂單後回來看看 📈
        </p>
      )}

      {hasData && (
        <>
          <section className="bg-white rounded-2xl shadow p-5 mb-6">
            <h2 className="font-semibold mb-4">每小時營收</h2>
            <div className="space-y-2">
              {stats.byHour.map((h) => (
                <div key={h.hour} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-gray-500 tabular-nums">
                    {String(h.hour).padStart(2, "0")}:00
                  </span>
                  <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{ width: `${(h.revenue / maxHourRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 text-right tabular-nums">
                    NT$ {h.revenue.toLocaleString()}
                  </span>
                  <span className="w-10 text-right text-gray-400">{h.count} 單</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-semibold mb-4">熱賣品排行（今日）</h2>
            <ol className="space-y-2">
              {stats.topItems.map((it, i) => (
                <li
                  key={it.title}
                  className="flex items-center justify-between text-sm border-b last:border-0 py-2"
                >
                  <span>
                    <span className="text-gray-400 mr-2">{i + 1}.</span>
                    {it.title}
                  </span>
                  <span className="text-gray-500">
                    {it.qty} 份 · NT$ {it.revenue.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
