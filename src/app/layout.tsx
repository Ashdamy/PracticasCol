import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import "@fontsource-variable/urbanist";
import "@fontsource-variable/bricolage-grotesque";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand/brand-logo";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: "PrácticasCol",
  description:
    "Prácticas, pasantías y contratos de aprendizaje en el Valle de Aburrá.",
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
    <html lang="es-CO" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const theme=localStorage.getItem("pc_theme");if(theme==="dark"||theme==="light")document.documentElement.dataset.theme=theme}catch{}`,
          }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Saltar al contenido
        </a>
        <header className="site-header">
          <div className="content header-inner">
            <Link href="/" className="brand" aria-label="PrácticasCol, inicio">
              <BrandLogo eager />
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
            <Link href="/" className="footer-brand" aria-label="PrácticasCol, inicio">
              <BrandLogo />
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
