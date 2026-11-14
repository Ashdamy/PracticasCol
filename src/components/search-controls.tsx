"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  countActiveFilters,
  parseSearchParams,
  toSearchParams,
  type FilterOptions,
  type SearchParams,
  type SearchResult,
  type FacetKey,
} from "@/lib/contracts";
import { SORT_LABELS } from "@/lib/catalog/labels";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export function SearchBox({ params = {} }: { params?: SearchParams }) {
  return (
    <form action="/practicas" className="search-box">
      <label htmlFor="search-query" className="sr-only">
        Programa, cargo o empresa
      </label>
      <Search aria-hidden="true" size={21} />
      <input
        id="search-query"
        name="q"
        defaultValue={params.q}
        placeholder="Programa, cargo o empresa"
        maxLength={120}
      />
      {Array.from(toSearchParams({ ...params, q: undefined, page: 1 })).map(
        ([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ),
      )}
      <Button type="submit" aria-label="Buscar prácticas">
        <span className="search-label-desktop">Buscar prácticas</span>
        <span className="search-label-mobile">Buscar</span>
      </Button>
    </form>
  );
}

const groups: { key: FacetKey; name: string; title: string }[] = [
  { key: "levels", name: "nivel", title: "Nivel de formación" },
  { key: "types", name: "tipo", title: "Tipo de oportunidad" },
  { key: "municipalities", name: "municipio", title: "Municipio" },
  { key: "modalities", name: "modalidad", title: "Modalidad" },
];

function FilterForm({
  result,
  options,
  mobile = false,
}: {
  result: SearchResult;
  options: FilterOptions;
  mobile?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(result.params);
  const prefix = mobile ? "mobile" : "desktop";
  return (
    <form
      className="filter-form"
      onChange={(e) => {
        const form = e.currentTarget;
        setDraft(
          parseSearchParams(
            new URLSearchParams(
              Array.from(new FormData(form), ([k, v]) => [k, String(v)]),
            ),
          ),
        );
      }}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() =>
          router.push(`/practicas?${toSearchParams({ ...draft, page: 1 })}`),
        );
      }}
    >
      {result.params.q && (
        <input type="hidden" name="q" value={result.params.q} />
      )}
      <input type="hidden" name="orden" value={result.params.sort} />
      <input type="hidden" name="por_pagina" value={result.params.pageSize} />
      {groups.map((g) => (
        <fieldset key={g.key}>
          <legend>{g.title}</legend>
          {result.facets[g.key].map((o) => (
            <label className="checkbox-row" key={o.value}>
              <input
                type="checkbox"
                name={g.name}
                value={o.value}
                defaultChecked={(
                  result.params[g.key] as string[] | undefined
                )?.includes(o.value)}
              />
              <span>{o.label}</span>
              <span className="facet-count">{o.count}</span>
            </label>
          ))}
          {g.key === "municipalities" && (
            <p className="help">Incluye también las prácticas remotas.</p>
          )}
        </fieldset>
      ))}
      <fieldset>
        <legend>Otras preferencias</legend>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="remunerada"
            value="1"
            defaultChecked={result.params.paidOnly}
          />
          Solo remuneradas
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="aplico"
            value="1"
            defaultChecked={result.params.eligibleOnly}
            disabled={!result.appliedProfile}
          />
          Solo las que aplico
        </label>
        {!result.appliedProfile && (
          <p className="help">
            <Link href="/perfil">Completa tu perfil</Link> para usar este
            filtro.
          </p>
        )}
      </fieldset>
      <label className="field" htmlFor={`${prefix}-institution`}>
        Institución
        <select
          id={`${prefix}-institution`}
          name="institucion"
          defaultValue={result.params.institutionId ?? ""}
        >
          <option value="">Todas las instituciones</option>
          {options.institutions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor={`${prefix}-program`}>
        Programa
        <select
          id={`${prefix}-program`}
          name="programa"
          defaultValue={result.params.programId ?? ""}
        >
          <option value="">Todos los programas</option>
          {options.programs.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor={`${prefix}-duration`}>
        Duración máxima (meses)
        <input
          id={`${prefix}-duration`}
          name="duracion_max"
          type="number"
          min="1"
          max="36"
          defaultValue={result.params.maxDurationMonths}
        />
      </label>
      <label className="field" htmlFor={`${prefix}-closing`}>
        Fecha de cierre
        <select
          id={`${prefix}-closing`}
          name="cierra_en"
          defaultValue={result.params.closesWithinDays ?? ""}
        >
          <option value="">Cualquier fecha</option>
          <option value="0">Hoy</option>
          <option value="7">En los próximos 7 días</option>
          <option value="15">En los próximos 15 días</option>
          <option value="30">En los próximos 30 días</option>
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Aplicando filtros…" : "Aplicar filtros"}
      </Button>
      <Link className="clear-link" href="/practicas">
        Limpiar filtros
      </Link>
    </form>
  );
}

export function Filters({
  result,
  options,
}: {
  result: SearchResult;
  options: FilterOptions;
}) {
  const count = countActiveFilters(result.params);
  return (
    <>
      <aside className="desktop-filters">
        <h2>Filtrar prácticas</h2>
        <FilterForm
          key={toSearchParams(result.params).toString()}
          result={result}
          options={options}
        />
      </aside>
      <div className="mobile-filters">
        <Sheet
          trigger={
            <Button variant="outline">
              <SlidersHorizontal size={17} />
              Filtros{count > 0 && <span>({count})</span>}
            </Button>
          }
        >
          <FilterForm
            key={toSearchParams(result.params).toString()}
            result={result}
            options={options}
            mobile
          />
        </Sheet>
      </div>
    </>
  );
}

export function SortControl({ params }: { params: SearchParams }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="sort">
      Ordenar por
      <select
        aria-label="Ordenar resultados"
        disabled={pending}
        value={params.sort ?? "relevancia"}
        onChange={(e) =>
          startTransition(() =>
            router.push(
              `/practicas?${toSearchParams({ ...params, sort: e.target.value as SearchParams["sort"], page: 1 })}`,
            ),
          )
        }
      >
        {Object.entries(SORT_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ActiveFilters({
  params,
  options,
}: {
  params: SearchParams;
  options: FilterOptions;
}) {
  const chips: { label: string; next: SearchParams }[] = [];
  for (const g of groups)
    for (const value of params[g.key] ?? [])
      chips.push({
        label: options[g.key].find((o) => o.value === value)?.label ?? value,
        next: {
          ...params,
          [g.key]: params[g.key]?.filter((v) => v !== value),
          page: 1,
        },
      });
  for (const [key, label] of [
    ["paidOnly", "Remuneradas"],
    ["eligibleOnly", "Solo las que aplico"],
    ["maxDurationMonths", `Máximo ${params.maxDurationMonths} meses`],
    [
      "closesWithinDays",
      params.closesWithinDays === 0
        ? "Cierra hoy"
        : `Cierra en ${params.closesWithinDays} ${params.closesWithinDays === 1 ? "día" : "días"}`,
    ],
    [
      "institutionId",
      options.institutions.find((o) => o.value === params.institutionId)?.label,
    ],
    [
      "programId",
      options.programs.find((o) => o.value === params.programId)?.label,
    ],
  ] as const)
    if (params[key] !== undefined && params[key] !== false)
      chips.push({
        label: label ?? key,
        next: { ...params, [key]: undefined, page: 1 },
      });
  return (
    chips.length > 0 && (
      <div className="active-filters" aria-label="Filtros activos">
        {chips.map((c) => (
          <Link
            className="chip"
            key={c.label}
            href={`/practicas?${toSearchParams(c.next)}`}
            aria-label={`Quitar filtro ${c.label}`}
          >
            {c.label}
            <X size={14} />
          </Link>
        ))}
        <Link
          className="clear-link"
          href={`/practicas?${toSearchParams({ q: params.q })}`}
        >
          Limpiar filtros
        </Link>
      </div>
    )
  );
}
