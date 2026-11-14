import { Skeleton } from "./ui/skeleton";
export function ResultsSkeleton() {
  return (
    <div className="content" role="status">
      <span className="sr-only">Cargando convocatorias…</span>
      <Skeleton className="skeleton-heading" />
      <div className="cards">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="skeleton-card" />
        ))}
      </div>
    </div>
  );
}
