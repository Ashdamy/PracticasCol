import { Suspense } from "react";
import { getFilterOptions, getProfile } from "@/server/queries";
import { ProfileForm } from "@/components/profile-form";
import { ResultsSkeleton } from "@/components/results-skeleton";
export const metadata = { title: "Mi perfil académico | PrácticasCol" };
async function Profile() {
  const [options, profile] = await Promise.all([
    getFilterOptions(),
    getProfile(),
  ]);
  return <ProfileForm options={options} profile={profile} />;
}
export default function Page() {
  return (
    <main id="main" className="content simple-page">
      <h1>Tu perfil académico</h1>
      <p>
        Revisa qué requisitos cumples según tu formación. Sin crear una cuenta
        ni compartir tu nombre o tu hoja de vida.
      </p>
      <Suspense fallback={<ResultsSkeleton />}>
        <Profile />
      </Suspense>
    </main>
  );
}
