import { IntentoGuardado, Tarea } from "@skilltrack/contracts";
import { z } from "zod";
import { pedir } from "../api.ts";

/**
 * Intentos de un estudiante que el docente puede ver: los de sus tareas, con las mismas rutas de
 * la ficha (HU-30). La práctica libre (sin tarea) no aparece, igual que en la ficha.
 */
export async function intentosDelEstudiante(estudianteId: number): Promise<IntentoGuardado[]> {
  const tareas = await pedir("GET", `/estudiantes/${estudianteId}/tareas`, z.array(Tarea));
  const listas = await Promise.all(
    tareas.map((t) => pedir("GET", `/tareas/${t.id}/intentos`, z.array(IntentoGuardado))),
  );
  const porId = new Map(listas.flat().map((i) => [i.id, i]));
  return [...porId.values()].sort((a, b) => b.iniciado_en.localeCompare(a.iniciado_en));
}

/** Escalón del mapa de calor (0–4) según la fracción de intentos con el error. */
export function escalonDeCalor(n: number, total: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0 || total <= 0) return 0;
  return Math.min(4, Math.ceil((4 * n) / total)) as 1 | 2 | 3 | 4;
}
