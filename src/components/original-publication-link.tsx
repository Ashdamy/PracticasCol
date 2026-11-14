import { ArrowUpRight } from "lucide-react";
import type { OpportunityCard } from "@/lib/contracts";

export function OriginalPublicationLink({
  opportunity,
}: {
  opportunity: Pick<OpportunityCard, "title" | "source">;
}) {
  return (
    <a
      className="original-publication-link"
      href={opportunity.source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Ver publicación original
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="sr-only">
        {`: ${opportunity.title}, en ${opportunity.source.name} (abre en una pestaña nueva)`}
      </span>
    </a>
  );
}
