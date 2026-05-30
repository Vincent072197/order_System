"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });
      if (res.status === 429) {
        setError("嘗試太頻繁，請稍候再試。");
        return;
      }
      if (res.status === 423) {
        setError("帳號暫時鎖定，請 15 分鐘後再試。");
        return;
      }
      if (!res.ok) {
        setError("帳號或密碼錯誤。");
        return;
      }
      router.replace("/staff");
      router.refresh();
    } catch {
      setError("網路錯誤，請重試。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4"
    >
      <h1 className="text-xl font-bold text-center">店家登入</h1>
      <label className="block">
        <span className="text-sm text-gray-600">Email</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          disabled={submitting}
        />
      </label>
      <label className="block">
        <span className="text-sm text-gray-600">密碼</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          minLength={1}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          disabled={submitting}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-black text-white rounded-lg py-2 font-semibold hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
