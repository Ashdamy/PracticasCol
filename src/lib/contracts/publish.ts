import { z } from "zod";
import {
  CompensationTypeSchema,
  DeadlineTypeSchema,
  EducationLevelSchema,
  ModalitySchema,
  OpportunityTypeSchema,
  PAID_COMPENSATION_TYPES,
} from "./enums";

/**
 * Formulario «Publica tu práctica» (contrato v0.1.3). Lo llena una empresa, universidad o institución, sin cuenta.
 * La server action es `submitOpportunity` (`@/server/actions/publish`). Nada se publica solo: todo queda en revisión.
 *
 * Los datos de contacto (`contact*`) son privados: solo los ve el administrador para verificar la oferta.
 * `trap` y `startedAt` son la protección contra bots y la UI debe enviarlos tal cual (ver cada campo).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Texto corto de una línea. */
const line = (min: number, max: number, minMessage: string) =>
  z.string().trim().min(min, minMessage).max(max, `Máximo ${max} caracteres`);

export const PUBLISH_LIMITS = {
  titleMax: 140,
  descriptionMin: 40,
  descriptionMax: 1500,
  requirementsMax: 10,
  requirementMax: 200,
  programsMax: 30,
} as const;

export const PublishOpportunitySchema = z
  .object({
    // ---- La práctica (pública) ----
    title: line(8, PUBLISH_LIMITS.titleMax, "Escribe un título de al menos 8 caracteres"),
    organizationName: line(2, 120, "Escribe el nombre de la empresa o institución"),
    type: OpportunityTypeSchema,
    levels: z.array(EducationLevelSchema).min(1, "Elige al menos un nivel de formación"),
    /** Ids del catálogo (`getFilterOptions().programs`). Vacío = cualquier programa. */
    programIds: z.array(z.string().min(1)).max(PUBLISH_LIMITS.programsMax).default([]),
    /** «y afines»: acepta programas del mismo núcleo de conocimiento. */
    acceptsRelatedPrograms: z.boolean().default(false),
    /** Slug del municipio (`getFilterOptions().municipalities`). Puede ser `null` solo si es remota. */
    municipality: z.string().min(1).nullable(),
    /** Quien publica sí sabe la modalidad: «no_especificada» no se acepta aquí. */
    modality: ModalitySchema.exclude(["no_especificada"]),
    compensationType: CompensationTypeSchema.exclude(["no_especificado"]),
    /** Monto mensual en pesos. Solo si hay pago. */
    compensationAmountCop: z.number().int().min(0).max(50_000_000).nullable().default(null),
    durationMonths: z.number().int().min(1, "Mínimo 1 mes").max(24, "Máximo 24 meses").nullable().default(null),
    deadlineType: DeadlineTypeSchema,
    /** yyyy-mm-dd. Obligatoria si `deadlineType` es «fecha». */
    deadlineDate: z.string().regex(ISO_DATE, "Usa el formato AAAA-MM-DD").nullable().default(null),
    startDate: z.string().regex(ISO_DATE, "Usa el formato AAAA-MM-DD").nullable().default(null),
    semesterMin: z.number().int().min(1).max(12).nullable().default(null),
    semesterMax: z.number().int().min(1).max(12).nullable().default(null),
    description: z
      .string()
      .trim()
      .min(PUBLISH_LIMITS.descriptionMin, `Describe la práctica en al menos ${PUBLISH_LIMITS.descriptionMin} caracteres`)
      .max(PUBLISH_LIMITS.descriptionMax, `Máximo ${PUBLISH_LIMITS.descriptionMax} caracteres`),
    /** Requisitos adicionales en texto libre (idioma, promedio…), uno por elemento. */
    requirements: z
      .array(z.string().trim().min(1).max(PUBLISH_LIMITS.requirementMax, `Máximo ${PUBLISH_LIMITS.requirementMax} caracteres por requisito`))
      .max(PUBLISH_LIMITS.requirementsMax, `Máximo ${PUBLISH_LIMITS.requirementsMax} requisitos`)
      .default([]),
    /** Enlace oficial donde el estudiante se postula. PrácticasCol nunca recibe hojas de vida. */
    applyUrl: z
      .string()
      .trim()
      .max(500)
      .refine(isHttpsUrl, "Pega el enlace oficial para postularse (debe empezar por https://)"),

    // ---- Contacto (privado: nunca se muestra en el sitio) ----
    contactName: line(2, 100, "Escribe tu nombre"),
    contactEmail: z.string().trim().max(200).pipe(z.email("Escribe un correo válido")),
    contactRole: z.string().trim().max(100).default(""),

    // ---- Declaraciones ----
    /** «La oferta es real, gratuita para el estudiante y tengo autorización para publicarla». */
    acceptsTerms: z.literal(true, { error: "Debes confirmar que la oferta es real y gratuita" }),
    /** «Acepto la política de privacidad» (enlace a /privacidad). */
    acceptsPrivacy: z.literal(true, { error: "Debes aceptar la política de privacidad" }),

    // ---- Antispam ----
    /**
     * Campo trampa: la UI lo pinta oculto (fuera de la vista y con `tabIndex={-1}`, `autoComplete="off"`,
     * `aria-hidden`) con un nombre atractivo para bots, p. ej. `name="website"`. Debe llegar vacío.
     */
    trap: z.string().max(500).default(""),
    /** `Date.now()` cuando se mostró el formulario (en el cliente). Envíos de menos de 3 s se rechazan. */
    startedAt: z.number().int().nonnegative(),
  })
  .superRefine((input, ctx) => {
    if (input.modality !== "remota" && !input.municipality) {
      ctx.addIssue({ code: "custom", path: ["municipality"], message: "Elige el municipio (o marca la modalidad remota)" });
    }
    if (input.deadlineType === "fecha" && !input.deadlineDate) {
      ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "Escribe la fecha de cierre" });
    }
    if (input.semesterMin !== null && input.semesterMax !== null && input.semesterMin > input.semesterMax) {
      ctx.addIssue({ code: "custom", path: ["semesterMax"], message: "El semestre máximo no puede ser menor que el mínimo" });
    }
    const paid = (PAID_COMPENSATION_TYPES as readonly string[]).includes(input.compensationType);
    if (!paid && input.compensationAmountCop !== null && input.compensationAmountCop > 0) {
      ctx.addIssue({ code: "custom", path: ["compensationAmountCop"], message: "Si no hay pago, deja el monto vacío" });
    }
  });

export type PublishOpportunityInput = z.input<typeof PublishOpportunitySchema>;
export type PublishOpportunity = z.output<typeof PublishOpportunitySchema>;

/** Respuesta de `submitOpportunity` cuando todo sale bien. */
export interface PublishReceipt {
  /** Código corto para que quien publica pueda referirse a su envío (p. ej. al escribir al administrador). */
  reference: string;
}
