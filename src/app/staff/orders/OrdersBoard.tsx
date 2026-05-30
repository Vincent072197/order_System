"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StaffOrderSummary } from "@/src/lib/staffOrders";
import { STATUS_BADGE, STATUS_LABEL } from "./statusMeta";

const POLL_MS = 4000;

export default function OrdersBoard({
  initial,
}: {
  initial: StaffOrderSummary[];
}) {
  const [orders, setOrders] = useState(initial);
  const [stale, setStale] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // publicIds that arrived since the page loaded — highlighted until acknowledged.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  // Ids we've already seen, so we only alert on genuinely new orders.
  const seenRef = useRef<Set<string>>(new Set(initial.map((o) => o.publicId)));
  const soundOnRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }, []);

  // Enabling sound must happen on a user gesture (browser autoplay policy);
  // the click also creates/resumes the AudioContext.
  function enableSound() {
    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioRef.current = new Ctor();
    }
    audioRef.current.resume();
    soundOnRef.current = true;
    setSoundOn(true);
    beep(); // confirmation blip
  }

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/staff/orders", { credentials: "same-origin" });
        if (!res.ok) {
          if (alive) setStale(true);
          return;
        }
        const data = (await res.json()) as { orders: StaffOrderSummary[] };
        if (!alive) return;
        setStale(false);

        const incoming = data.orders.filter((o) => !seenRef.current.has(o.publicId));
        data.orders.forEach((o) => seenRef.current.add(o.publicId));

        if (incoming.length > 0) {
          setFreshIds((prev) => {
            const next = new Set(prev);
            incoming.forEach((o) => next.add(o.publicId));
            return next;
          });
          if (soundOnRef.current) beep();
          document.title = `🔔 ${incoming.length} 筆新訂單`;
        }
        setOrders(data.orders);
      } catch {
        if (alive) setStale(true);
      }
    }
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [beep]);

  function acknowledge() {
    setFreshIds(new Set());
    document.title = "訂單列表";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {freshIds.size > 0 ? (
          <button
            onClick={acknowledge}
            className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            🔔 {freshIds.size} 筆新訂單（點此清除提示）
          </button>
        ) : (
          <span className="text-sm text-gray-400">即時更新中（每 4 秒）</span>
        )}
        {!soundOn ? (
          <button
            onClick={enableSound}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            🔕 開啟提示音
          </button>
        ) : (
          <span className="text-sm text-emerald-600">🔔 提示音已開</span>
        )}
      </div>

      {stale && (
        <p className="text-xs text-amber-600">
          ⚠️ 即時更新中斷，顯示的可能不是最新資料。
        </p>
      )}

      {orders.length === 0 && <p className="text-gray-500">目前沒有訂單。</p>}

      {orders.map((o) => {
        const isFresh = freshIds.has(o.publicId);
        return (
          <Link
            key={o.publicId}
            href={`/staff/orders/${o.publicId}`}
            className={`flex items-center justify-between rounded-xl px-4 py-3 transition ${
              isFresh
                ? "bg-emerald-50 ring-2 ring-emerald-400 shadow"
                : "bg-white shadow hover:shadow-md"
            }`}
          >
            <div className="flex items-center gap-3">
              {isFresh && <span className="text-xs text-emerald-600 font-bold">NEW</span>}
              <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status]}`}>
                {STATUS_LABEL[o.status]}
              </span>
              <span className="font-medium">{o.tableLabel ?? o.source}</span>
              <span className="text-sm text-gray-500">{o.itemCount} 項</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">NT$ {o.total}</div>
              <div className="text-xs text-gray-400">{formatTime(o.createdAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
