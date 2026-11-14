"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="content simple-page">
      <h1>No pudimos cargar esta página</h1>
      <p>
        Intenta cargarla de nuevo. Los filtros de tu búsqueda siguen en la
        dirección.
      </p>
      <Button onClick={reset}>Volver a intentar</Button>
    </main>
  );
}
