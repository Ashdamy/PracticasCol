import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import "@fontsource-variable/urbanist";
import "@fontsource-variable/bricolage-grotesque";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";
export const metadata: Metadata = {
  title: "PrácticasCol",
  description:
    "Prácticas, pasantías y contratos de aprendizaje en el Valle de Aburrá.",
  other: { "page-type": "software", "site-kind": "software" },
  openGraph: {
    title: "PrácticasCol",
    description: "Tu próxima práctica en el Valle de Aburrá.",
    locale: "es_CO",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO" data-type="software" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          Saltar al contenido
        </a>
        <header className="site-header">
          <div className="content header-inner">
            <Link href="/" className="brand" aria-label="PrácticasCol, inicio">
              <span className="brand-mark">
                <ArrowUpRight size={25} aria-hidden="true" />
              </span>
              prácticas<span className="brand-col">col</span>
              <span className="brand-dot">.</span>
            </Link>
            <nav aria-label="Navegación principal">
              <Link href="/practicas">Buscar prácticas</Link>
              <Link href="/fuentes">Nuestras fuentes</Link>
            </nav>
            <ThemeToggle />
            <Link href="/perfil" className="profile-link">
              <GraduationCap size={19} />
              <span>Mi perfil</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        {process.env.USE_MOCKS !== "false" && (
          <p className="demo-notice">
            Catálogo de demostración · Convocatorias ficticias
          </p>
        )}
        {children}
        <footer className="site-footer">
          <div className="content">
            <Link href="/" className="footer-brand">
              prácticascol.
            </Link>
            <p>Tu formación tiene un próximo paso.</p>
            <div className="footer-bottom">
              <span>Medellín y el Valle de Aburrá</span>
              <Link href="/fuentes">
                Fuentes y verificación <ArrowUpRight size={15} />
              </Link>
              <span>Proyecto académico · PrácticasCol</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
