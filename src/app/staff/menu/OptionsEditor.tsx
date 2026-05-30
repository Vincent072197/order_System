"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOptionGroup } from "@/src/lib/menuAdmin";
import { withCsrf } from "./csrf";

type GroupForm = {
  open: null | "new" | string; // publicId when editing
  title: string;
  selectionKind: "single" | "multi";
  minChoices: string;
  maxChoices: string;
  sortOrder: string;
};

type ChoiceForm = {
  // open identifies which group we're adding/editing a choice in
  groupPublicId: string | null;
  choicePublicId: string | null; // null = creating
  label: string;
  priceDelta: string;
  isDefault: boolean;
  sortOrder: string;
};

const emptyGroup: GroupForm = {
  open: null,
  title: "",
  selectionKind: "single",
  minChoices: "0",
  maxChoices: "1",
  sortOrder: "0",
};
const emptyChoice: ChoiceForm = {
  groupPublicId: null,
  choicePublicId: null,
  label: "",
  priceDelta: "0",
  isDefault: false,
  sortOrder: "0",
};

export default function OptionsEditor({
  itemPublicId,
  groups,
}: {
  itemPublicId: string;
  groups: AdminOptionGroup[];
}) {
  const router = useRouter();
  const [gForm, setGForm] = useState<GroupForm>(emptyGroup);
  const [cForm, setCForm] = useState<ChoiceForm>(emptyChoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: withCsrf(body ? { "content-type": "application/json" } : {}),
        credentials: "same-origin",
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `操作失敗 (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("網路錯誤，請重試。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitGroup() {
    if (!gForm.title.trim()) return setError("請輸入選項組名稱");
    const min = Number(gForm.minChoices) || 0;
    const max = Number(gForm.maxChoices) || 1;
    if (min > max) return setError("最少不能大於最多");
    const isNew = gForm.open === "new";
    const payload = isNew
      ? {
          itemPublicId,
          title: gForm.title.trim(),
          selectionKind: gForm.selectionKind,
          minChoices: min,
          maxChoices: max,
          sortOrder: Number(gForm.sortOrder) || 0,
        }
      : {
          title: gForm.title.trim(),
          selectionKind: gForm.selectionKind,
          minChoices: min,
          maxChoices: max,
          sortOrder: Number(gForm.sortOrder) || 0,
        };
    const ok = await send(
      isNew ? "/api/staff/menu/option-groups" : `/api/staff/menu/option-groups/${gForm.open}`,
      isNew ? "POST" : "PATCH",
      payload,
    );
    if (ok) setGForm(emptyGroup);
  }

  async function submitChoice() {
    if (!cForm.label.trim()) return setError("請輸入選項名稱");
    const isNew = cForm.choicePublicId === null;
    const payload = isNew
      ? {
          groupPublicId: cForm.groupPublicId,
          label: cForm.label.trim(),
          priceDelta: Number(cForm.priceDelta) || 0,
          isDefault: cForm.isDefault,
          sortOrder: Number(cForm.sortOrder) || 0,
        }
      : {
          label: cForm.label.trim(),
          priceDelta: Number(cForm.priceDelta) || 0,
          isDefault: cForm.isDefault,
          sortOrder: Number(cForm.sortOrder) || 0,
        };
    const ok = await send(
      isNew ? "/api/staff/menu/option-choices" : `/api/staff/menu/option-choices/${cForm.choicePublicId}`,
      isNew ? "POST" : "PATCH",
      payload,
    );
    if (ok) setCForm(emptyChoice);
  }

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-500">選項組</span>
        <button
          onClick={() => setGForm({ ...emptyGroup, open: "new" })}
          disabled={busy}
          className="text-sm text-blue-600 hover:underline disabled:opacity-50"
        >
          ＋ 新增選項組
        </button>
      </div>

      {gForm.open !== null && (
        <GroupFormView form={gForm} setForm={setGForm} busy={busy} onSubmit={submitGroup} onCancel={() => setGForm(emptyGroup)} />
      )}

      {groups.length === 0 && gForm.open === null && (
        <p className="text-xs text-gray-400">（此品項沒有選項組，例如「甜度」「冰塊」）</p>
      )}

      {groups.map((g) => (
        <div key={g.publicId} className="rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {g.title}{" "}
              <span className="text-xs text-gray-400">
                （{g.selectionKind === "single" ? "單選" : "多選"}，{g.minChoices}-{g.maxChoices}）
              </span>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() =>
                  setGForm({
                    open: g.publicId,
                    title: g.title,
                    selectionKind: g.selectionKind,
                    minChoices: String(g.minChoices),
                    maxChoices: String(g.maxChoices),
                    sortOrder: String(g.sortOrder),
                  })
                }
                disabled={busy}
                className="text-blue-600 hover:underline disabled:opacity-50"
              >
                編輯
              </button>
              <button
                onClick={() => {
                  if (confirm(`刪除選項組「${g.title}」及其所有選項？`))
                    send(`/api/staff/menu/option-groups/${g.publicId}`, "DELETE");
                }}
                disabled={busy}
                className="text-rose-600 hover:underline disabled:opacity-50"
              >
                刪除
              </button>
            </div>
          </div>

          <div className="mt-2 space-y-1">
            {g.choices.map((ch) => (
              <div key={ch.publicId} className="flex items-center justify-between text-sm pl-3">
                <span>
                  {ch.label}
                  {ch.priceDelta !== 0 && (
                    <span className="text-gray-400"> （{ch.priceDelta > 0 ? "+" : ""}{ch.priceDelta}）</span>
                  )}
                  {ch.isDefault && <span className="text-gray-400">（預設）</span>}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setCForm({
                        groupPublicId: g.publicId,
                        choicePublicId: ch.publicId,
                        label: ch.label,
                        priceDelta: String(ch.priceDelta),
                        isDefault: ch.isDefault,
                        sortOrder: String(ch.sortOrder),
                      })
                    }
                    disabled={busy}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`刪除選項「${ch.label}」？`))
                        send(`/api/staff/menu/option-choices/${ch.publicId}`, "DELETE");
                    }}
                    disabled={busy}
                    className="text-rose-600 hover:underline disabled:opacity-50"
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}

            {cForm.groupPublicId === g.publicId ? (
              <ChoiceFormView form={cForm} setForm={setCForm} busy={busy} onSubmit={submitChoice} onCancel={() => setCForm(emptyChoice)} />
            ) : (
              <button
                onClick={() => setCForm({ ...emptyChoice, groupPublicId: g.publicId })}
                disabled={busy}
                className="text-xs text-blue-600 hover:underline pl-3 disabled:opacity-50"
              >
                ＋ 新增選項
              </button>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function GroupFormView({
  form,
  setForm,
  busy,
  onSubmit,
  onCancel,
}: {
  form: GroupForm;
  setForm: (f: GroupForm) => void;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-blue-100 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="名稱（例：甜度）"
          className="border rounded-lg px-3 py-2 text-sm"
          maxLength={100}
        />
        <select
          value={form.selectionKind}
          onChange={(e) => setForm({ ...form, selectionKind: e.target.value as "single" | "multi" })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="single">單選</option>
          <option value="multi">多選</option>
        </select>
        <label className="text-xs text-gray-500">
          最少
          <input
            type="number"
            value={form.minChoices}
            onChange={(e) => setForm({ ...form, minChoices: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-500">
          最多
          <input
            type="number"
            value={form.maxChoices}
            onChange={(e) => setForm({ ...form, maxChoices: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={onSubmit} disabled={busy} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
          {busy ? "儲存中…" : "儲存"}
        </button>
        <button onClick={onCancel} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm hover:bg-gray-300 disabled:opacity-50">
          取消
        </button>
      </div>
    </div>
  );
}

function ChoiceFormView({
  form,
  setForm,
  busy,
  onSubmit,
  onCancel,
}: {
  form: ChoiceForm;
  setForm: (f: ChoiceForm) => void;
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-blue-100 p-3 space-y-2 ml-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="名稱（例：少糖）"
          className="border rounded-lg px-3 py-2 text-sm"
          maxLength={100}
        />
        <label className="text-xs text-gray-500">
          加價
          <input
            type="number"
            value={form.priceDelta}
            onChange={(e) => setForm({ ...form, priceDelta: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        設為預設
      </label>
      <div className="flex gap-2">
        <button onClick={onSubmit} disabled={busy} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
          {busy ? "儲存中…" : "儲存"}
        </button>
        <button onClick={onCancel} disabled={busy} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm hover:bg-gray-300 disabled:opacity-50">
          取消
        </button>
      </div>
    </div>
  );
}
