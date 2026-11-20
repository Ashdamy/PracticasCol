import { describe, expect, it } from "vitest";
import { createFakeSupabase, op } from "@/test/fake-supabase";
import { formatSubmissionContacts, submissionContacts } from "./admin-submissions";

describe("contacto de las publicaciones", () => {
  it("lee el contacto de la convocatoria y lo muestra para verificar", async () => {
    const { client, queries } = createFakeSupabase(() => ({
      data: [{ contact_name: "Ana Pérez", contact_email: "ana@empresa.com", contact_role: "Talento humano", created_at: "2026-11-20T15:00:00Z" }],
    }));
    const contacts = await submissionContacts(client, "opp-1");
    expect(op(queries[0], "eq")).toEqual(["opportunity_id", "opp-1"]);
    const text = formatSubmissionContacts(contacts);
    expect(text).toContain("Ana Pérez (Talento humano) <ana@empresa.com>");
    expect(text).toContain("privado");
  });

  it("si no vino del formulario no muestra nada", () => {
    expect(formatSubmissionContacts([])).toBe("");
  });
});
