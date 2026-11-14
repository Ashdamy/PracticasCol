import Link from "next/link";
import {
  ArrowUpRight,
  MapPin,
  Banknote,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import {
  ELIGIBILITY_DISCLAIMER,
  type OpportunityCard as Card,
} from "@/lib/contracts";
import {
  OPPORTUNITY_TYPE_LABELS,
  MODALITY_LABELS,
  EDUCATION_LEVEL_LABELS,
} from "@/lib/catalog/labels";
import { date, deadline, money } from "@/lib/format";
import { EligibilityBadge } from "./eligibility-badge";
import { Badge } from "./ui/badge";
import { OriginalPublicationLink } from "./original-publication-link";
export function OpportunityCard({ opportunity: o }: { opportunity: Card }) {
  return (
    <article className="opportunity-card">
      <div className="card-top">
        <Badge>{OPPORTUNITY_TYPE_LABELS[o.type]}</Badge>
        <span
          className={
            o.deadline.daysLeft !== null && o.deadline.daysLeft <= 7
              ? "deadline urgent"
              : "deadline"
          }
        >
          <Clock3 size={14} aria-hidden="true" />
          {deadline(o.deadline)}
        </span>
      </div>
      <p className="organization">{o.organization.name}</p>
      <h2>
        <Link href={`/practicas/${o.slug}`}>
          {o.title}
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      </h2>
      <div className="card-facts">
        <span>
          <MapPin size={16} aria-hidden="true" />
          {o.municipality?.name ??
            (o.modality === "remota"
              ? "Desde cualquier municipio"
              : "Municipio sin publicar")}{" "}
          · {MODALITY_LABELS[o.modality]}
        </span>
        <span>
          <Banknote size={16} aria-hidden="true" />
          {money(o.compensation)}
        </span>
      </div>
      <p className="levels">
        {o.levels.length
          ? o.levels.map((l) => EDUCATION_LEVEL_LABELS[l]).join(" · ")
          : "Nivel sin publicar"}
      </p>
      <EligibilityBadge verdict={o.eligibility?.verdict} />
      <p className="card-disclaimer">{ELIGIBILITY_DISCLAIMER}</p>
      <div className="card-source">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>
          Fuente: {o.source.name}
          <br />
          {o.isStale ? "Pendiente de actualizar" : "Última verificación"}:{" "}
          {date(o.lastVerifiedAt)}
          <OriginalPublicationLink opportunity={o} />
        </span>
      </div>
    </article>
  );
}
