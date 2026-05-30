"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StaffOrderSummary } from "@/src/lib/staffOrders";
import { STATUS_BADGE, STATUS_LABEL } from "./statusMeta";
import {
  DEFAULT_SOUND,
  SOUND_PRESETS,
  SOUND_STORAGE_KEY,
  isSoundId,
  playSound,
  type SoundId,
} from "./sounds";

const POLL_MS = 4000;

export default function OrdersBoard({
  initial,
}: {
  initial: StaffOrderSummary[];
}) {
  const [orders, setOrders] = useState(initial);
  const [stale, setStale] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [sound, setSound] = useState<SoundId>(DEFAULT_SOUND);
  // publicIds that arrived since the page loaded — highlighted until acknowledged.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const seenRef = useRef<Set<string>>(new Set(initial.map((o) => o.publicId)));
  const soundOnRef = useRef(false);
  const soundRef = useRef<SoundId>(DEFAULT_SOUND); // current choice, read in poll callback
  const audioRef = useRef<AudioContext | null>(null);

  // Load the saved sound choice once on mount (async callback avoids a
  // synchronous setState in the effect body).
  useEffect(() => {
    (async () => {
      const saved = window.localStorage.getItem(SOUND_STORAGE_KEY);
      if (isSoundId(saved)) {
        soundRef.current = saved;
        setSound(saved);
      }
    })();
  }, []);

  // Create/resume the AudioContext — must run on a user gesture (autoplay).
  function ensureCtx(): AudioContext {
    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioRef.current = new Ctor();
    }
    audioRef.current.resume();
    return audioRef.current;
  }

  function preview() {
    playSound(ensureCtx(), soundRef.current);
  }

  function enableSound() {
    ensureCtx();
    soundOnRef.current = true;
    setSoundOn(true);
    preview();
  }

  function changeSound(id: SoundId) {
    soundRef.current = id;
    setSound(id);
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, id);
    } catch {
      /* best-effort */
    }
    playSound(ensureCtx(), id); // hear it immediately
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
          if (soundOnRef.current && audioRef.current) {
            playSound(audioRef.current, soundRef.current);
          }
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
  }, []);

  function acknowledge() {
    setFreshIds(new Set());
    document.title = "訂單列表";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

        <div className="flex items-center gap-2">
          {!soundOn ? (
            <button
              onClick={enableSound}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              🔕 開啟提示音
            </button>
          ) : (
            <>
              <span className="text-sm text-emerald-600">🔔</span>
              <select
                value={sound}
                onChange={(e) => changeSound(e.target.value as SoundId)}
                className="text-sm border rounded-lg px-2 py-1.5"
              >
                {SOUND_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                onClick={preview}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                試聽
              </button>
            </>
          )}
        </div>
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
