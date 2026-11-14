import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="content simple-page">
      <h1>No encontramos esta convocatoria</h1>
      <p>
        Puede que el enlace haya cambiado o la convocatoria se haya retirado.
      </p>
      <Link className="button button-primary" href="/practicas">
        Buscar otras prácticas
      </Link>
    </main>
  );
}
