/** Municipios del MVP (AGENTS.md §5): Área Metropolitana del Valle de Aburrá + Rionegro. */
export interface Municipality {
  slug: string;
  name: string;
  /** Código DANE (DIVIPOLA). */
  daneCode: string;
  metro: boolean;
}

export const MUNICIPALITIES: readonly Municipality[] = [
  { slug: "medellin", name: "Medellín", daneCode: "05001", metro: true },
  { slug: "bello", name: "Bello", daneCode: "05088", metro: true },
  { slug: "itagui", name: "Itagüí", daneCode: "05360", metro: true },
  { slug: "envigado", name: "Envigado", daneCode: "05266", metro: true },
  { slug: "sabaneta", name: "Sabaneta", daneCode: "05631", metro: true },
  { slug: "la-estrella", name: "La Estrella", daneCode: "05380", metro: true },
  { slug: "caldas", name: "Caldas", daneCode: "05129", metro: true },
  { slug: "copacabana", name: "Copacabana", daneCode: "05212", metro: true },
  { slug: "girardota", name: "Girardota", daneCode: "05308", metro: true },
  { slug: "barbosa", name: "Barbosa", daneCode: "05079", metro: true },
  { slug: "rionegro", name: "Rionegro", daneCode: "05615", metro: false },
];

const bySlug = new Map(MUNICIPALITIES.map((m) => [m.slug, m]));
export const getMunicipality = (slug: string | null | undefined) => (slug ? bySlug.get(slug) : undefined);
