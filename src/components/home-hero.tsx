import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { SearchBox } from "@/components/search-controls";
import students from "../../public/images/students-first-step.webp";
import "./home-hero.css";

export function HomeHero() {
  return (
    <section className="pc-hero" aria-labelledby="home-heading">
      <div className="content pc-hero-inner" data-enter>
        <div className="pc-hero-intro">
          <h1 id="home-heading" className="pc-hero-title">
            Prácticas para
            <br />
            lo que <span>viene.</span>
          </h1>
          <div className="pc-hero-search">
            <p>
              Ese primer paso también es tuyo. Encuentra prácticas, pasantías y
              contratos de aprendizaje en el Valle de Aburrá.
            </p>
            <SearchBox />
            <div className="pc-hero-assurances">
              <span><Check size={16} aria-hidden="true" />Sin registrarte</span>
              <span><Check size={16} aria-hidden="true" />Todos los niveles de formación</span>
            </div>
          </div>
        </div>
        <div className="pc-hero-art">
          <Image
            src={students}
            alt="Ilustración de tres estudiantes compartiendo ideas con un cuaderno y un computador."
            sizes="(max-width: 767px) 100vw, (max-width: 1100px) 85vw, 900px"
            preload
          />
        </div>
        <nav className="pc-hero-levels" aria-label="Buscar prácticas por nivel de formación">
          <p>Empieza por<br /><strong>lo que estudias.</strong></p>
          <Link href="/practicas?nivel=tecnico_laboral,tecnico_profesional">
            Soy técnico<ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <Link href="/practicas?nivel=tecnologo">
            Soy tecnólogo o aprendiz SENA<ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <Link href="/practicas?nivel=universitario,posgrado">
            Estudio en la universidad<ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </section>
  );
}
