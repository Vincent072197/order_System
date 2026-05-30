"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
    >
      列印
    </button>
  );
}
