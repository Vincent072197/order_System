"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminMenuCategory } from "@/src/lib/menuAdmin";
import { withCsrf } from "./csrf";

type FormState = { slug: string; title: string; sortOrder: string; isActive: boolean };

export default function CategoryAdmin({
  categories,
}: {
  categories: AdminMenuCategory[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // null | "new" | slug
  const [form, setForm] = useState<FormState>({ slug: "", title: "", sortOrder: "0", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm({ slug: "", title: "", sortOrder: "0", isActive: true });
    setError(null);
    setEditing("new");
  }
  function openEdit(c: AdminMenuCategory) {
    setForm({ slug: c.slug, title: c.title, sortOrder: String(c.sortOrder), isActive: c.isActive });
    setError(null);
    setEditing(c.slug);
  }

  async function submit() {
    setError(null);
    if (!form.title.trim()) return setError("請輸入分類名稱");
    const isNew = editing === "new";
    if (isNew && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(form.slug)) {
      return setError("slug 只能用小寫英數、- 或 _，且開頭為英數");
    }

    setBusy(true);
    try {
      const res = await fetch(
        isNew ? "/api/staff/menu/categories" : `/api/staff/menu/categories/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: withCsrf({ "content-type": "application/json" }),
          credentials: "same-origin",
          body: JSON.stringify(
            isNew
              ? {
                  slug: form.slug,
                  title: form.title.trim(),
                  sortOrder: Number(form.sortOrder) || 0,
                  isActive: form.isActive,
                }
              : {
                  title: form.title.trim(),
                  sortOrder: Number(form.sortOrder) || 0,
                  isActive: form.isActive,
                },
          ),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `儲存失敗 (${res.status})`);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: AdminMenuCategory) {
    if (!confirm(`確定要刪除分類「${c.title}」嗎？`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/menu/categories/${c.slug}`, {
        method: "DELETE",
        headers: withCsrf({}),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `刪除失敗 (${res.status})`);
        return;
      }
      const data = (await res.json()) as { softDeleted?: boolean };
      if (data.softDeleted) alert("此分類底下還有品項，無法真正刪除，已改為「停用」。");
      router.refresh();
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">分類</h2>
        <button
          onClick={openCreate}
          disabled={busy}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          ＋ 新增分類
        </button>
      </div>

      {editing !== null && (
        <div className="border border-blue-100 rounded-xl p-4 space-y-3">
          {editing === "new" && (
            <label className="text-sm block">
              slug（網址用，建立後不可改）
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g. desserts"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              名稱
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                maxLength={100}
              />
            </label>
            <label className="text-sm">
              排序
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            啟用中
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "儲存中…" : "儲存"}
            </button>
            <button
              onClick={() => setEditing(null)}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.slug} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
            <div>
              <span className="font-medium">{c.title}</span>
              <span className="ml-2 text-gray-400">{c.slug}</span>
              {!c.isActive && <span className="ml-2 text-gray-400">（停用）</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => openEdit(c)} disabled={busy} className="text-blue-600 hover:underline disabled:opacity-50">
                編輯
              </button>
              <button onClick={() => remove(c)} disabled={busy} className="text-rose-600 hover:underline disabled:opacity-50">
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
