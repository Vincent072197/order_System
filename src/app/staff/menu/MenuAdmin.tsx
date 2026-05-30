"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminMenu,
  AdminMenuCategory,
  AdminMenuItem,
} from "@/src/lib/menuAdmin";
import { withCsrf } from "./csrf";
import OptionsEditor from "./OptionsEditor";

type FormState = {
  categorySlug: string;
  title: string;
  price: string; // kept as string for the input; parsed on submit
  description: string;
  isAvailable: boolean;
  sortOrder: string;
};

function emptyForm(categories: AdminMenuCategory[]): FormState {
  return {
    categorySlug: categories[0]?.slug ?? "",
    title: "",
    price: "",
    description: "",
    isAvailable: true,
    sortOrder: "0",
  };
}

function itemToForm(it: AdminMenuItem): FormState {
  return {
    categorySlug: it.categorySlug,
    title: it.title,
    price: String(it.price),
    description: it.description,
    isAvailable: it.isAvailable,
    sortOrder: String(it.sortOrder),
  };
}

export default function MenuAdmin({ initialMenu }: { initialMenu: AdminMenu }) {
  const router = useRouter();
  const { categories, items } = initialMenu;

  // null = closed, "new" = create form, otherwise the publicId being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(categories));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null); // item publicId

  function openCreate() {
    setForm(emptyForm(categories));
    setError(null);
    setEditing("new");
  }
  function openEdit(it: AdminMenuItem) {
    setForm(itemToForm(it));
    setError(null);
    setEditing(it.publicId);
  }
  function close() {
    setEditing(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    const price = Number(form.price);
    if (!form.title.trim()) return setError("請輸入品項名稱");
    if (!Number.isFinite(price) || price < 0) return setError("價格不正確");
    if (!form.categorySlug) return setError("請選擇分類");

    const payload = {
      categorySlug: form.categorySlug,
      title: form.title.trim(),
      price,
      description: form.description,
      isAvailable: form.isAvailable,
      sortOrder: Number(form.sortOrder) || 0,
    };

    setBusy(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(
        isNew ? "/api/staff/menu/items" : `/api/staff/menu/items/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: withCsrf({ "content-type": "application/json" }),
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `儲存失敗 (${res.status})`);
        return;
      }
      close();
      router.refresh(); // server component reloads the list
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(it: AdminMenuItem) {
    if (!confirm(`確定要刪除「${it.title}」嗎？`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/menu/items/${it.publicId}`, {
        method: "DELETE",
        headers: withCsrf({}),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `刪除失敗 (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setBusy(false);
    }
  }

  // One-click "out of stock" toggle — flips is_available without opening the form.
  async function toggleStock(it: AdminMenuItem) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/menu/items/${it.publicId}`, {
        method: "PATCH",
        headers: withCsrf({ "content-type": "application/json" }),
        credentials: "same-origin",
        body: JSON.stringify({ isAvailable: !it.isAvailable }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `切換失敗 (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setBusy(false);
    }
  }

  const byCategory = categories.map((c) => ({
    category: c,
    items: items.filter((i) => i.categorySlug === c.slug),
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{items.length} 個品項</p>
        <button
          onClick={openCreate}
          disabled={busy || categories.length === 0}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          ＋ 新增品項
        </button>
      </div>

      {categories.length === 0 && (
        <p className="text-rose-600 text-sm">
          目前沒有分類，請先建立分類（分類管理會在下一階段加入）。
        </p>
      )}

      {editing !== null && (
        <ItemForm
          form={form}
          setForm={setForm}
          categories={categories}
          busy={busy}
          error={error}
          isNew={editing === "new"}
          onSubmit={submit}
          onCancel={close}
        />
      )}

      {byCategory.map(({ category, items: catItems }) => (
        <section key={category.slug}>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            {category.title}
            {!category.isActive && "（已停用）"}
          </h2>
          <div className="space-y-2">
            {catItems.length === 0 && (
              <p className="text-xs text-gray-400">（此分類沒有品項）</p>
            )}
            {catItems.map((it) => (
              <div
                key={it.publicId}
                className="bg-white rounded-xl shadow px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {it.title}
                      {!it.isAvailable && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          缺貨
                        </span>
                      )}
                    </div>
                    {it.description && (
                      <div className="text-sm text-gray-500">{it.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">NT$ {it.price}</span>
                    <button
                      onClick={() => toggleStock(it)}
                      disabled={busy}
                      className={`text-sm hover:underline disabled:opacity-50 ${
                        it.isAvailable ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      {it.isAvailable ? "標為缺貨" : "恢復供應"}
                    </button>
                    <button
                      onClick={() =>
                        setExpanded(expanded === it.publicId ? null : it.publicId)
                      }
                      disabled={busy}
                      className="text-sm text-gray-600 hover:underline disabled:opacity-50"
                    >
                      選項 ({it.options.length})
                    </button>
                    <button
                      onClick={() => openEdit(it)}
                      disabled={busy}
                      className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => remove(it)}
                      disabled={busy}
                      className="text-sm text-rose-600 hover:underline disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </div>
                </div>
                {expanded === it.publicId && (
                  <OptionsEditor itemPublicId={it.publicId} groups={it.options} />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemForm({
  form,
  setForm,
  categories,
  busy,
  error,
  isNew,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  categories: AdminMenuCategory[];
  busy: boolean;
  error: string | null;
  isNew: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-3 border border-blue-100">
      <h3 className="font-semibold">{isNew ? "新增品項" : "編輯品項"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          分類
          <select
            value={form.categorySlug}
            onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
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
      <label className="text-sm block">
        名稱
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full border rounded-lg px-3 py-2"
          maxLength={200}
        />
      </label>
      <label className="text-sm block">
        價格 (NT$)
        <input
          type="number"
          min={0}
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="mt-1 w-full border rounded-lg px-3 py-2"
        />
      </label>
      <label className="text-sm block">
        描述
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-1 w-full border rounded-lg px-3 py-2"
          rows={2}
          maxLength={2000}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isAvailable}
          onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
        />
        供應中
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "儲存中…" : "儲存"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}

