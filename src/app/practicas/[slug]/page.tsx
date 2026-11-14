import { cache, Suspense } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  Banknote,
  CalendarDays,
  Clock3,
  ShieldCheck,
  CircleCheck,
  CircleHelp,
  CircleMinus,
} from "lucide-react";
import { getOpportunity } from "@/server/queries";
import { ELIGIBILITY_DISCLAIMER } from "@/lib/contracts";
import {
  EDUCATION_LEVEL_LABELS,
  MODALITY_LABELS,
  OPPORTUNITY_TYPE_LABELS,
} from "@/lib/catalog/labels";
import { date, deadline, money, semesterRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { ResultsSkeleton } from "@/components/results-skeleton";
// React cache only deduplicates within the request; eligibility is never shared.
const readOpportunity = cache(getOpportunity);

export async function generateMetadata(
  { params }: PageProps<"/practicas/[slug]">,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const opportunity = await readOpportunity((await params).slug);
  if (!opportunity) notFound();
  const title = `${opportunity.title} en ${opportunity.organization.name} | PrácticasCol`;
  const description = `${opportunity.organization.name}. ${opportunity.description}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "PrácticasCol",
      locale: "es_CO",
      type: "website",
      images: (await parent).openGraph?.images ?? [],
    },
  };
}

async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const o = await readOpportunity((await params).slug);
  if (!o) notFound();
  const expired = o.status === "vencida";
  return (
    <div className="content detail">
      <Link href="/practicas" className="back-link">
        <ArrowLeft size={17} />
        Volver a las prácticas
      </Link>
      {expired && (
        <div className="notice" role="status">
          <strong>Esta convocatoria ya cerró.</strong> Puedes consultar sus
          requisitos o buscar otras prácticas.
        </div>
      )}
      <div className="detail-grid">
        <article>
          <Badge>{OPPORTUNITY_TYPE_LABELS[o.type]}</Badge>
          <p className="organization">{o.organization.name}</p>
          <h1>{o.title}</h1>
          <p className="detail-location">
            <MapPin size={18} />
            {o.municipality?.name ?? "Municipio no publicado"} ·{" "}
            {MODALITY_LABELS[o.modality]}
          </p>
          <div className="detail-facts">
            <div>
              <Banknote />
              <span>
                Compensación<strong>{money(o.compensation)}</strong>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                Duración
                <strong>
                  {o.durationMonths
                    ? `${o.durationMonths.min === o.durationMonths.max ? o.durationMonths.min : `${o.durationMonths.min}–${o.durationMonths.max}`} meses`
                    : "No publicada"}
                </strong>
              </span>
            </div>
            <div>
              <CalendarDays />
              <span>
                Fecha de cierre
                <strong>
                  {o.deadline.date
                    ? date(o.deadline.date)
                    : deadline(o.deadline)}
                </strong>
              </span>
            </div>
            <div>
              <CalendarDays />
              <span>
                Inicio
                <strong>
                  {o.startDate ? date(o.startDate) : "Por confirmar"}
                </strong>
              </span>
            </div>
          </div>
          <section className="reading">
            <h2>Sobre esta práctica</h2>
            <p className="preserve-lines">{o.description}</p>
            <h2>Requisitos de la convocatoria</h2>
            <dl className="requirements">
              <dt>Formación</dt>
              <dd>
                {o.levels.map((l) => EDUCATION_LEVEL_LABELS[l]).join(" · ") ||
                  "No publicada"}
              </dd>
              <dt>Programas</dt>
              <dd>
                {o.requirements.programs.map((p) => p.name).join(", ") ||
                  "No publicados"}
                {o.requirements.acceptsRelatedPrograms &&
                  ". También considera programas afines; confirma con la fuente."}
              </dd>
              <dt>Semestre</dt>
              <dd>
                {semesterRange(
                  o.requirements.semesterMin,
                  o.requirements.semesterMax,
                )}
              </dd>
              <dt>Institución</dt>
              <dd>
                {o.requirements.institutions === null
                  ? "Abierta a cualquier institución"
                  : o.requirements.institutions.map((i) => i.name).join(", ") ||
                    "Consulta la fuente"}
              </dd>
            </dl>
            {o.requirements.other.length > 0 && (
              <ul>
                {o.requirements.other.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="reading">
            <h2>Fuente y verificación</h2>
            <p className="source-verification">
              <ShieldCheck size={18} />
              Última verificación: {date(o.lastVerifiedAt)}
            </p>
            {o.isStale && (
              <p className="notice">
                Esta convocatoria lleva más de 14 días sin verificarse. Confirma
                que sigue abierta en la fuente.
              </p>
            )}
            <ul className="source-list">
              {o.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.name}
                    <ArrowUpRight size={16} />
                    <span className="sr-only">
                      {" "}
                      (abre en una pestaña nueva)
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
              Consultar publicación original <ArrowUpRight size={15} />
            </a>
          </section>
        </article>
        <aside className="detail-sidebar">
          <section className="apply-panel">
            <span className={expired ? "deadline" : "deadline urgent"}>
              <Clock3 size={15} />
              {deadline(o.deadline)}
            </span>
            <h2>
              {expired
                ? "Sigue buscando tu práctica"
                : "Postúlate en la fuente oficial"}
            </h2>
            <p>
              {expired
                ? "Esta oportunidad ya no recibe postulaciones."
                : "La organización recibe tu postulación en su propia plataforma."}
            </p>
            <a
              className="button button-primary"
              href={expired ? "/practicas" : o.applyUrl}
              target={expired ? undefined : "_blank"}
              rel={expired ? undefined : "noopener noreferrer"}
            >
              {expired ? (
                "Ver prácticas abiertas"
              ) : (
                <>
                  Ir a la convocatoria oficial
                  <ArrowUpRight size={18} />
                  <span className="sr-only"> (abre en una pestaña nueva)</span>
                </>
              )}
            </a>
            <p className="help">
              {expired
                ? "Consulta otras convocatorias disponibles."
                : "Se abre en una pestaña nueva. No envíes dinero para postularte."}
            </p>
          </section>
          <section className="eligibility-panel">
            <h2>¿Aplico a esta práctica?</h2>
            <EligibilityBadge verdict={o.eligibility?.verdict} />
            {o.eligibility ? (
              <ul className="checks">
                {o.eligibility.checks.map((c, i) => {
                  const Icon =
                    c.status === "cumple"
                      ? CircleCheck
                      : c.status === "no_cumple"
                        ? CircleMinus
                        : CircleHelp;
                  return (
                    <li key={`${c.code}-${i}`}>
                      <Icon size={18} className={c.status} />
                      <span>{c.message}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                <p>
                  Con tu nivel de formación y programa podemos revisar los
                  requisitos principales.
                </p>
                <Link className="button button-outline" href="/perfil">
                  Completar mi perfil
                </Link>
                <p className="help">Sin cuenta y sin datos personales.</p>
              </>
            )}
            <p className="disclaimer">{ELIGIBILITY_DISCLAIMER}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
export default function Page(props: PageProps<"/practicas/[slug]">) {
  return (
    <main id="main">
      <Suspense fallback={<ResultsSkeleton />}>
        <Detail params={props.params} />
      </Suspense>
    </main>
  );
}
