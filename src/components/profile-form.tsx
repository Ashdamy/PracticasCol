"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FilterOptions, StudentProfile } from "@/lib/contracts";
import { saveProfile, clearProfile } from "@/server/actions/profile";
import { Button } from "./ui/button";
export function ProfileForm({
  options,
  profile,
}: {
  options: FilterOptions;
  profile: StudentProfile | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [institution, setInstitution] = useState(profile?.institutionId ?? "");
  const [program, setProgram] = useState(profile?.programId ?? "");
  const programSelect = useRef<HTMLSelectElement>(null);
  const [showAllPrograms, setShowAllPrograms] = useState(
    () =>
      !!profile &&
      !options.programs
        .find((p) => p.value === profile.programId)
        ?.institutionIds.includes(profile.institutionId),
  );
  const programs = options.programs.filter(
    (p) =>
      showAllPrograms || !institution || p.institutionIds.includes(institution),
  );
  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const selected = options.programs.find((p) => p.value === program);
        if (!selected) {
          setError("Elige tu programa académico.");
          return;
        }
        setError("");
        setFields({});
        startTransition(async () => {
          const result = await saveProfile({
            institutionId: institution,
            programId: program,
            level: selected.level,
            semester: data.get("semester")
              ? Number(data.get("semester"))
              : null,
            isGraduate: data.get("graduate") === "on",
            municipality: String(data.get("municipality") || "") || null,
            preferredModalities: profile?.preferredModalities ?? [],
          });
          if (result.ok) {
            router.push("/practicas");
            router.refresh();
          } else {
            setError(result.error.message);
            setFields(result.error.fieldErrors ?? {});
          }
        });
      }}
    >
      <label className="field" htmlFor="institution">
        Institución
        <select
          id="institution"
          required
          value={institution}
          onChange={(e) => {
            setInstitution(e.target.value);
            setProgram("");
            setShowAllPrograms(false);
          }}
          aria-invalid={!!fields.institutionId}
          aria-describedby={
            fields.institutionId ? "institution-error" : undefined
          }
        >
          <option value="">Elige tu institución</option>
          {options.institutions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {fields.institutionId && (
          <span id="institution-error" className="field-error">
            {fields.institutionId}
          </span>
        )}
      </label>
      <label className="field" htmlFor="program">
        Programa académico
        <select
          id="program"
          ref={programSelect}
          required
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          aria-invalid={!!fields.programId}
          aria-describedby={
            [
              fields.programId ? "program-error" : "",
              showAllPrograms ? "program-help" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        >
          <option value="">Elige tu programa</option>
          {programs.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {fields.programId && (
          <span id="program-error" className="field-error">
            {fields.programId}
          </span>
        )}
      </label>
      {institution && (
        <div>
          <Button
            type="button"
            variant="outline"
            aria-controls="program"
            onClick={() => {
              if (
                showAllPrograms &&
                !options.programs
                  .find((p) => p.value === program)
                  ?.institutionIds.includes(institution)
              )
                setProgram("");
              setShowAllPrograms(!showAllPrograms);
              programSelect.current?.focus();
            }}
          >
            {showAllPrograms
              ? "Ver programas de mi institución"
              : "Mi programa no aparece → ver todos los programas"}
          </Button>
          {showAllPrograms && (
            <p id="program-help" className="help" role="status">
              Mostramos todos los programas del catálogo. Elige el tuyo; tu
              institución se mantiene. El catálogo aún está incompleto.
            </p>
          )}
        </div>
      )}
      <label className="field" htmlFor="semester">
        Semestre o trimestre (opcional)
        <input
          id="semester"
          name="semester"
          type="number"
          min="1"
          max="12"
          defaultValue={profile?.semester ?? ""}
        />
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          name="graduate"
          defaultChecked={profile?.isGraduate}
        />
        Ya terminé materias o soy egresado
      </label>
      <label className="field" htmlFor="municipality">
        Municipio (opcional)
        <select
          id="municipality"
          name="municipality"
          defaultValue={profile?.municipality ?? ""}
        >
          <option value="">Prefiero no indicarlo</option>
          {options.municipalities.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="profile-actions">
        <Button disabled={pending} type="submit">
          {pending ? "Guardando perfil…" : "Guardar perfil y ver prácticas"}
        </Button>
        {profile && (
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await clearProfile();
                if (r.ok) {
                  router.push("/practicas");
                  router.refresh();
                } else setError(r.error.message);
              })
            }
          >
            Borrar mi perfil
          </Button>
        )}
      </div>
      <Link className="clear-link" href="/practicas">
        Continuar sin perfil
      </Link>
      <p className="help">
        Tu perfil se guarda en este navegador. Puedes borrarlo cuando quieras.
      </p>
    </form>
  );
}
