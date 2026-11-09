import { UsuarioActual, type Rol } from "@skilltrack/contracts";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ErrorApi, SinConexion, pedir } from "./api.ts";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin-conexion" }
  | { tipo: "anonimo" }
  | { tipo: "activo"; usuario: UsuarioActual };

interface Sesion {
  estado: Estado;
  entrar(usuario: string, clave: string): Promise<void>;
  salir(): Promise<void>;
  recargar(): Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  const recargar = useCallback(async () => {
    try {
      const usuario = await pedir("GET", "/auth/me", UsuarioActual);
      setEstado({ tipo: "activo", usuario });
    } catch (error) {
      if (error instanceof SinConexion) setEstado({ tipo: "sin-conexion" });
      else if (error instanceof ErrorApi && error.estado === 401) setEstado({ tipo: "anonimo" });
      else throw error;
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const entrar = useCallback(async (usuario: string, clave: string) => {
    const actual = await pedir("POST", "/auth/login", UsuarioActual, { usuario, clave });
    setEstado({ tipo: "activo", usuario: actual });
  }, []);

  const salir = useCallback(async () => {
    await pedir("POST", "/auth/logout", null).catch(() => undefined);
    setEstado({ tipo: "anonimo" });
  }, []);

  return (
    <Contexto.Provider value={{ estado, entrar, salir, recargar }}>{children}</Contexto.Provider>
  );
}

export function useSesion(): Sesion {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error("useSesion fuera de ProveedorSesion");
  return sesion;
}

export function roles(usuario: UsuarioActual): Set<Rol> {
  return new Set(usuario.membresias.map((m) => m.rol));
}

/** Pantalla inicial de cada rol (PA-HU01-01). */
export function rutaInicial(usuario: UsuarioActual): string {
  const r = roles(usuario);
  if (r.has("admin_inst")) return "/usuarios";
  if (r.has("docente")) return "/estudiantes";
  if (r.has("investigador")) return "/investigacion";
  return "/tareas";
}
