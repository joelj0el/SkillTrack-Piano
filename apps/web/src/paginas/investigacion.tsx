import { RevisionReglas } from "../investigacion/RevisionReglas.tsx";
import { PaginaCabecera } from "../ui/base.tsx";

export function ModoInvestigacion() {
  return (
    <section>
      <PaginaCabecera titulo="Modo investigación" />
      <p className="aviso">
        Pendiente: la grabación y el empaquetado local del modo investigación se construyen en una
        iteración posterior.
      </p>
      <RevisionReglas />
    </section>
  );
}
