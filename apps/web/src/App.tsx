import { Salud } from "@skilltrack/contracts";
import { useEffect, useState } from "react";

type EstadoApi = "consultando" | "ok" | "no disponible";

interface Props {
  obtenerSalud?: () => Promise<unknown>;
}

async function obtenerSaludDeLaApi(): Promise<unknown> {
  const respuesta = await fetch("/api/health");
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.json();
}

export function App({ obtenerSalud = obtenerSaludDeLaApi }: Props) {
  const [estadoApi, setEstadoApi] = useState<EstadoApi>("consultando");

  useEffect(() => {
    let vigente = true;
    obtenerSalud()
      .then(
        (cuerpo): EstadoApi => (Salud.safeParse(cuerpo).success ? "ok" : "no disponible"),
        (): EstadoApi => "no disponible",
      )
      .then((estado) => {
        if (vigente) setEstadoApi(estado);
      });
    return () => {
      vigente = false;
    };
  }, [obtenerSalud]);

  return (
    <main>
      <h1>SkillTrack-Piano</h1>
      <p>{`API: ${estadoApi}`}</p>
    </main>
  );
}
