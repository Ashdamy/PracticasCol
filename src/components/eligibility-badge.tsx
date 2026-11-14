import { CircleCheck, CircleHelp, CircleMinus } from "lucide-react";
import type { EligibilityVerdict } from "@/lib/contracts";
import { Badge } from "./ui/badge";
const labels = {
  cumple: "Cumples los criterios principales",
  revisar: "Hay requisitos por revisar",
  no_cumple: "Hay un requisito que no cumples",
  sin_perfil: "¿Aplicas? Completa tu perfil",
};
export function EligibilityBadge({
  verdict = "sin_perfil",
}: {
  verdict?: EligibilityVerdict;
}) {
  const Icon =
    verdict === "cumple"
      ? CircleCheck
      : verdict === "no_cumple"
        ? CircleMinus
        : CircleHelp;
  return (
    <Badge className={`eligibility ${verdict}`}>
      <Icon size={15} aria-hidden="true" />
      {labels[verdict]}
    </Badge>
  );
}
