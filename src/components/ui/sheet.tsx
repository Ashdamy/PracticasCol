"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
export function Sheet({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="sheet-content"
          onSubmit={() => setOpen(false)}
        >
          <div className="section-heading">
            <Dialog.Title>Filtrar prácticas</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Cerrar filtros">
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description>
            Elige lo que necesitas. Las prácticas remotas se incluyen con
            cualquier municipio.
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
