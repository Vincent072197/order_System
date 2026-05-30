import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import pool from "@/src/lib/db";
import { requireStaff } from "@/src/lib/auth/server";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function StaffTablesPage() {
  const staff = await requireStaff();

  // Build the QR target from the request host so it works on whatever domain
  // this is served from (Vercel prod, preview, or localhost) — no env needed.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const base = `${proto}://${host}`;

  const res = await pool.query<{ label: string; public_id: string; is_active: boolean }>(
    `SELECT label, public_id, is_active
       FROM tables
      WHERE restaurant_id = $1
      ORDER BY label`,
    [staff.restaurantId],
  );

  const tables = await Promise.all(
    res.rows.map(async (t) => {
      const url = `${base}/table/${t.public_id}`;
      const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
      return { label: t.label, isActive: t.is_active, url, qr };
    }),
  );

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold">桌位 QR Code</h1>
        <div className="flex gap-3 items-center">
          <PrintButton />
          <Link href="/staff" className="text-sm text-blue-600 hover:underline">
            ← 後台首頁
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4 print:hidden">
        顧客掃描 QR 即可進入該桌點餐。目前網域：{base}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {tables.map((t) => (
          <div
            key={t.url}
            className="bg-white rounded-2xl shadow p-4 flex flex-col items-center text-center break-inside-avoid"
          >
            <div className="text-lg font-bold mb-2">
              桌號 {t.label}
              {!t.isActive && (
                <span className="ml-1 text-xs text-gray-400">（停用）</span>
              )}
            </div>
            {/* data-URL QR; next/image adds no value for an inline data URI */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={`QR code for table ${t.label}`} className="w-40 h-40" />
            <div className="text-[10px] text-gray-400 mt-2 break-all">{t.url}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
