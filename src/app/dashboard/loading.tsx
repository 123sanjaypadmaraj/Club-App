export default function DashboardLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
      <div className="card h-64 animate-pulse" />
    </div>
  );
}
