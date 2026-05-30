// Loading placeholder shown while the menu is fetched. Mirrors the rough
// shape of the real menu (header + a couple of sections of cards) so the
// layout doesn't jump when data arrives.
export default function MenuSkeleton() {
  return (
    <div className="pt-32 min-h-screen animate-pulse" aria-hidden>
      <div className="px-4">
        <div className="h-8 w-40 bg-gray-200 rounded mb-6" />
        {[0, 1].map((s) => (
          <section key={s} className="mb-8">
            <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex justify-between gap-4 rounded-xl border p-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 bg-gray-200 rounded" />
                    <div className="h-3 w-3/4 bg-gray-100 rounded" />
                  </div>
                  <div className="h-16 w-16 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
