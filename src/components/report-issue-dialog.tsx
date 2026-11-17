"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Flag, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import type { IssueReason } from "@/lib/contracts";
import { ISSUE_REASON_LABELS } from "@/lib/catalog/labels";
import { reportIssue } from "@/server/actions/report";
import { Button } from "./ui/button";
import "./report-issue-dialog.css";

export function ReportIssueDialog({ opportunityId }: { opportunityId: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<IssueReason | "">("");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [focusRequest, setFocusRequest] = useState<{ target: "reason" | "comment" | "summary" } | null>(null);
  const sending = useRef(false);
  const reasonInput = useRef<HTMLSelectElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open || pending) return;
    if (success) confirmation.current?.focus();
    else if (focusRequest) {
      if (focusRequest.target === "reason") reasonInput.current?.focus();
      else if (focusRequest.target === "comment") commentInput.current?.focus();
      else errorSummary.current?.focus();
    }
  }, [open, pending, success, focusRequest]);

  function clearFieldError(field: string) {
    if (!fields[field]) return;
    const remaining = { ...fields };
    delete remaining[field];
    setFields(remaining);
    if (Object.keys(remaining).length === 0) setError("");
    setFocusRequest(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || success) return;
    if (!reason) {
      setFields({ reason: "Elige un motivo para el reporte." });
      setError("Revisa el motivo antes de enviar.");
      setFocusRequest({ target: "reason" });
      return;
    }
    sending.current = true;
    setError("");
    setFields({});
    setFocusRequest(null);
    startTransition(async () => {
      try {
        const result = await reportIssue({ opportunityId, reason, comment });
        if (result.ok) {
          setSuccess(true);
          setComment("");
        } else {
          const errors = result.error.fieldErrors ?? {};
          setError(result.error.message);
          setFields({
            ...errors,
            ...(errors.reason ? { reason: "Elige uno de los motivos disponibles." } : {}),
            ...(errors.comment ? { comment: "Usa máximo 500 caracteres en el comentario." } : {}),
          });
          setFocusRequest({ target: errors.reason ? "reason" : errors.comment ? "comment" : "summary" });
        }
      } catch {
        setError("No pudimos enviar el reporte. Revisa tu conexión e intenta de nuevo.");
        setFocusRequest({ target: "summary" });
      } finally {
        sending.current = false;
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" className="report-trigger">
          <Flag size={16} aria-hidden="true" /> Reportar un problema
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="report-overlay" />
        <Dialog.Content
          className="report-dialog"
          onOpenAutoFocus={(event) => {
            if (pending) return;
            event.preventDefault();
            if (success) confirmation.current?.focus();
            else reasonInput.current?.focus();
          }}
        >
          <Dialog.Title className="report-title">Reportar un problema</Dialog.Title>
          <Dialog.Description className="report-description">
            Cuéntanos qué pasa con esta convocatoria. No incluyas nombres,
            correos, teléfonos ni otros datos personales.
          </Dialog.Description>
          <Dialog.Close className="icon-button report-close" aria-label="Cerrar reporte">
            <X size={20} aria-hidden="true" />
          </Dialog.Close>
          {success ? (
            <div className="report-confirmation" role="status">
              <h3 ref={confirmation} tabIndex={-1}>Gracias, lo revisaremos</h3>
              <p>Tu reporte nos ayuda a mantener la información actualizada.</p>
              <Dialog.Close asChild><Button>Cerrar</Button></Dialog.Close>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-busy={pending}>
              {error && (
                <div className="report-error" role="alert" tabIndex={-1} ref={errorSummary}>
                  <p>{error}</p>
                  {Object.entries(fields).filter(([key]) => key !== "reason" && key !== "comment").map(([key, message]) => (
                    <p key={key}>{message}</p>
                  ))}
                </div>
              )}
              <div className="report-field">
                <label htmlFor={`${id}-reason`}>Motivo</label>
                <select
                  id={`${id}-reason`}
                  ref={reasonInput}
                  value={reason}
                  required
                  disabled={pending}
                  onChange={event => {
                    setReason(event.target.value as IssueReason | "");
                    clearFieldError("reason");
                  }}
                  aria-invalid={!!fields.reason}
                  aria-describedby={fields.reason ? `${id}-reason-error` : undefined}
                >
                  <option value="">Elige un motivo</option>
                  {Object.entries(ISSUE_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {fields.reason && <p className="field-error" id={`${id}-reason-error`}>{fields.reason}</p>}
              {reason === "sospechosa" && (
                <p className="report-warning" role="status">
                  Una práctica nunca debe cobrar. No envíes dinero para postularte.
                </p>
              )}
              <div className="report-field">
                <label htmlFor={`${id}-comment`}>Comentario (opcional)</label>
                <textarea
                  id={`${id}-comment`}
                  ref={commentInput}
                  rows={4}
                  maxLength={500}
                  value={comment}
                  disabled={pending}
                  onChange={event => {
                    setComment(event.target.value);
                    clearFieldError("comment");
                  }}
                  aria-invalid={!!fields.comment}
                  aria-describedby={`${id}-limit${fields.comment ? ` ${id}-comment-error` : ""}`}
                />
              </div>
              <p className="report-limit" id={`${id}-limit`}>{comment.length}/500 caracteres</p>
              {fields.comment && <p className="field-error" id={`${id}-comment-error`}>{fields.comment}</p>}
              <p className="report-progress" role="status">{pending ? "Enviando reporte…" : ""}</p>
              <div className="report-actions">
                <Dialog.Close asChild><Button type="button" variant="outline">Cerrar</Button></Dialog.Close>
                <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar reporte"}</Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
