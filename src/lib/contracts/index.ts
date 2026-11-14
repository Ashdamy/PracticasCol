/**
 * ★ CONTRATO entre lógica (Claude) y UI (Codex). Ver AGENTS.md §11 y §15.
 * Importa siempre desde "@/lib/contracts".
 * Cambios que rompen compatibilidad → subir CONTRACT_VERSION y anotar en el registro (§16).
 */
export const CONTRACT_VERSION = "0.1.1";

export * from "./enums";
export * from "./profile";
export * from "./eligibility";
export * from "./opportunity";
export * from "./search";
export * from "./actions";
