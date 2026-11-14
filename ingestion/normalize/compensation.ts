/** Compensación: tipo y monto mensual en COP. Función pura. */
import type { CompensationType } from "@/lib/contracts";
import type { Normalized } from "../types";
import { excerpt, fold, isBlank, result } from "./text";

export interface CompensationValue {
  type: CompensationType;
  amountCop: number | null;
}

export const MIN_PLAUSIBLE_COP = 100_000;
export const MAX_PLAUSIBLE_COP = 20_000_000;

export const UNLABELED_AMOUNT_NOTE = "Monto sin etiqueta: se asumió salario";

const UNPAID_RE = /no remunerad|sin remuneracion|ad[- ]?honorem|sin pago|no (es )?pag[ao]|voluntariado/;
const UNSPECIFIED_RE = /a convenir|por (definir|convenir|acordar)|no (se )?(especific|inform|indic)|negociable|^n\/?a$/;
const SMMLV_RE = /smm?lv|smlmv|salarios? minimos?|minimo legal/;

function parseAmount(f: string): number | null {
  let m = /(\d+(?:[.,]\d+)?)\s*(?:mill(?:on|ones)?\b|mm\b)/.exec(f);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1_000_000);
  m = /(\d+(?:[.,]\d+)?)\s*mil\b/.exec(f);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1_000);
  m = /(\d{1,3}(?:[.,'’ ]\d{3})+|\d{4,})(?:[.,]\d{1,2})?(?!\d)/.exec(f);
  if (m) return Number(m[1].replace(/[.,'’ ]/g, ""));
  return null;
}

function labelOf(f: string): CompensationType | null {
  if (/sostenimiento/.test(f)) return "apoyo_sostenimiento";
  if (/auxilio|bonificacion|subsidio|beca|estimulo/.test(f)) return "auxilio";
  if (/salari|sueldo|smm?lv|smlmv|minimo legal/.test(f)) return "salario";
  return null;
}

export function normalizeCompensation(text: string | null | undefined): Normalized<CompensationValue> {
  if (isBlank(text)) return result({ type: "no_especificado", amountCop: null }, "alta");
  const f = fold(text);

  if (UNPAID_RE.test(f)) return result({ type: "sin_remuneracion", amountCop: null }, "alta");

  const amountCop = parseAmount(f);
  const label = labelOf(f);

  if (amountCop === null) {
    if (SMMLV_RE.test(f)) {
      return result(
        { type: label ?? "salario", amountCop: null },
        "media",
        `Monto expresado en salarios mínimos ("${excerpt(text)}"): falta el valor en pesos`,
      );
    }
    if (label) return result({ type: label, amountCop: null }, "alta");
    if (UNSPECIFIED_RE.test(f)) return result({ type: "no_especificado", amountCop: null }, "alta");
    if (/remunerad|pag[ao]/.test(f)) {
      return result(
        { type: "salario", amountCop: null },
        "media",
        "La fuente dice que es remunerada pero no indica tipo ni monto",
      );
    }
    return result(
      { type: "no_especificado", amountCop: null },
      "baja",
      `No se pudo interpretar el pago: "${excerpt(text)}"`,
    );
  }

  const type = label ?? "salario";
  if (amountCop < MIN_PLAUSIBLE_COP || amountCop > MAX_PLAUSIBLE_COP) {
    return result(
      { type, amountCop },
      "baja",
      `Monto fuera del rango esperado (${amountCop} COP en "${excerpt(text)}"); confirmar`,
    );
  }
  if (!label) {
    return result({ type, amountCop }, "media", UNLABELED_AMOUNT_NOTE);
  }
  return result({ type, amountCop }, "alta");
}
