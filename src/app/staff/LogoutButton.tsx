"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      // Read CSRF token from the (non-httpOnly) cookie and echo as header.
      const csrf = readCookie("staff_csrf");
      await fetch("/api/staff/auth/logout", {
        method: "POST",
        headers: csrf ? { "x-csrf-token": csrf } : {},
        credentials: "same-origin",
      });
    } finally {
      router.replace("/staff/login");
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
    >
      {busy ? "登出中…" : "登出"}
    </button>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}
