import type { OrderStatus } from "@/src/lib/orders";

// Client-safe: type-only import above is erased at build, so this file never
// pulls `pg` into the browser bundle. Display strings + badge styles only.

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "待接單",
  confirmed: "已確認",
  preparing: "製作中",
  ready: "可取餐",
  served: "已送出",
  completed: "已完成",
  cancelled: "已取消",
};

// Action-oriented button text for a transition, keyed by the TARGET status.
// In the simplified flow each target is reached one way, so this is unambiguous.
export const TRANSITION_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  preparing: "確認接單",
  completed: "訂單完成",
  cancelled: "取消訂單",
};

export const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready: "bg-emerald-100 text-emerald-800",
  served: "bg-teal-100 text-teal-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-rose-100 text-rose-800",
};
