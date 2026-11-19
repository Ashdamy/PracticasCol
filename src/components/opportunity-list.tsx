import Link from "next/link";
import { ArrowUpRight, MapPin, Clock3, ShieldCheck } from "lucide-react";
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
import { OriginalPublicationLink } from "./original-publication-link";
import { OrganizationLogo } from "./organization-logo";

export function OpportunityListItem({ opportunity: o }: { opportunity: Card }) {
  return (
    <article className="opportunity-card opportunity-row">
      <OrganizationLogo organization={o.organization} type={o.type} />
      <div className="opportunity-body">
        <div className="row-heading">
          <p className="organization">{o.organization.name}</p>
          <span
            className={
              o.deadline.daysLeft !== null && o.deadline.daysLeft <= 7
                ? "deadline urgent"
                : "deadline"
            }
          >
            <Clock3 size={13} aria-hidden="true" />
            {deadline(o.deadline)}
          </span>
        </div>
        <h2>
          <Link href={`/practicas/${o.slug}`}>
            {o.title}
            <ArrowUpRight className="row-arrow" size={21} aria-hidden="true" />
          </Link>
        </h2>
        <div className="row-meta">
          <span>
            <MapPin size={14} aria-hidden="true" />
            {o.municipality?.name ??
              (o.modality === "remota"
                ? "Cualquier municipio"
                : "Ubicación sin publicar")}{" "}
            · {MODALITY_LABELS[o.modality]}
          </span>
          <span>{OPPORTUNITY_TYPE_LABELS[o.type]}</span>
          {o.durationMonths && (
            <span>
              {o.durationMonths.min === o.durationMonths.max
                ? o.durationMonths.min
                : `${o.durationMonths.min}–${o.durationMonths.max}`}{" "}
              meses
            </span>
          )}
        </div>
        <p className="levels">
          {o.levels.map((l) => EDUCATION_LEVEL_LABELS[l]).join(" · ") ||
            "Nivel sin publicar"}
        </p>
        <div className="row-bottom">
          <div className="row-eligibility">
            <EligibilityBadge verdict={o.eligibility?.verdict} />
            <p className="card-disclaimer">{ELIGIBILITY_DISCLAIMER}</p>
          </div>
          <strong className="compensation">{money(o.compensation)}</strong>
        </div>
        <div className="card-source">
          <ShieldCheck size={13} aria-hidden="true" />
          <span className="source-name">{o.source.name}</span>
          <OriginalPublicationLink opportunity={o} />
          <span className="source-date">
            {o.isStale ? "Pendiente de actualizar" : "Verificada"}:{" "}
            {date(o.lastVerifiedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
