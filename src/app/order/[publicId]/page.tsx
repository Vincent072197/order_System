import { notFound } from "next/navigation";
import { getPublicOrderStatus } from "@/src/lib/orders";
import OrderStatusView from "./OrderStatusView";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ publicId: string }>; // Next 16: params is a Promise
}) {
  const { publicId } = await params;
  if (!UUID_RE.test(publicId)) notFound();

  const order = await getPublicOrderStatus(publicId);
  if (!order) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <OrderStatusView initial={order} />
      </div>
    </main>
  );
}
