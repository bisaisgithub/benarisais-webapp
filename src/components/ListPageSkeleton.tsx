/**
 * The shape of a list page while its data is still coming from the server.
 *
 * Rendered by each list route's loading.tsx, which Next swaps in the moment
 * a navigation starts. Mirroring the real layout — same heading, same
 * controls, same column count — means the page does not jump when the
 * content arrives, and the reader can see where they are headed before it
 * gets there.
 */
export default function ListPageSkeleton({
  title,
  columns,
  rows = 5,
}: {
  title: string;
  columns: number;
  rows?: number;
}) {
  return (
    <main className="flex-1" aria-busy="true">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-foreground/60">Loading…</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-20 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-8 w-28 animate-pulse rounded-lg bg-foreground/10" />
          </div>
        </div>

        <div className="mt-6 h-10 w-full max-w-md animate-pulse rounded-full bg-foreground/10" />

        <div className="mt-4 overflow-hidden rounded-2xl border border-foreground/10">
          <div className="flex gap-4 border-b border-foreground/10 bg-foreground/5 px-4 py-3">
            {Array.from({ length: columns }, (_, column) => (
              <div
                key={column}
                className="h-4 flex-1 animate-pulse rounded bg-foreground/10"
              />
            ))}
          </div>

          {Array.from({ length: rows }, (_, row) => (
            <div
              key={row}
              className="flex gap-4 border-b border-foreground/10 px-4 py-4 last:border-0"
            >
              {Array.from({ length: columns }, (_, column) => (
                <div
                  key={column}
                  // Staggered, so the rows read as one sweep rather than a
                  // block flashing in unison.
                  style={{ animationDelay: `${(row * columns + column) * 40}ms` }}
                  className="h-4 flex-1 animate-pulse rounded bg-foreground/10"
                />
              ))}
            </div>
          ))}
        </div>

        <span className="sr-only" role="status">
          Loading {title}
        </span>
      </div>
    </main>
  );
}
