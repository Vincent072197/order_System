"use client";

import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
    >
      重新整理
    </button>
  );
}
