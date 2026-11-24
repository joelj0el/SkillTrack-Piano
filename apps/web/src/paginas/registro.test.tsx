import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App.tsx";
import { ProveedorSesion } from "../sesion.tsx";

// Datos SINTÉTICOS. El monto de 50 Bs es de la prueba, no un precio del producto.
type Ruta = `${"GET" | "POST"} ${string}`;
type Respuesta =
  { estado: number; cuerpo: unknown } | ((cuerpo: unknown) => { estado: number; cuerpo: unknown });

const yo = (cambios: Record<string, unknown> = {}) => ({
  id: 7,
  usuario: "rosa.mendoza",
  nombre_visible: "Rosa Mendoza",
  superadmin: false,
  clave_temporal: false,
  correo: "rosa@ejemplo.org",
  telefono: "+591 70000000",
  pago_pendiente: true,
  membresias: [
    { institucion_id: 3, rol: "admin_inst" },
    { institucion_id: 3, rol: "docente" },
  ],
  ...cambios,
});

const PLANES = [1, 2].map((id) => ({
  id,
  nombre: id === 1 ? "Docente" : "Institución",
  descripcion: "Plan",
  beneficios: [],
  precio_bs: null,
  periodo: "mensual",
  limite_docentes: null,
  limite_estudiantes: null,
  destacado: id === 2,
  activo: true,
}));

const PAGO = {
  institucion: "Clases de piano Rosa",
  plan: "Docente",
  periodo: "mensual",
  monto_bs: 50,
  codigo_convenio: null,
  estado: "pendiente",
  vence_plan: null,
  proveedor: "simulado",
  qr: null,
};
const QR = {
  id_transaccion: "ST-000001",
  estado: "pendiente",
  simulado: true,
  imagen_png: null,
  vence_en: "2100-01-01T00:00:00Z",
};

function servidor(rutas: Partial<Record<Ruta, Respuesta>>) {
  const llamadas: { ruta: string; cuerpo: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const ruta = `${init?.method ?? "GET"} ${url}` as Ruta;
      const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined;
      llamadas.push({ ruta, cuerpo });
      const r = rutas[ruta];
      const { estado, cuerpo: salida } =
        typeof r === "function" ? r(cuerpo) : (r ?? { estado: 404, cuerpo: { detail: "No" } });
      return new Response(JSON.stringify(salida), { status: estado });
    }),
  );
  return llamadas;
}

function abrir(ruta: string) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </MemoryRouter>,
  );
}

function llenar(etiqueta: RegExp | string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("registro de compradores y cuenta pendiente de pago (HU-40)", () => {
  it("PU-web-45: el registro envía el plan elegido y la aceptación, y lleva a la pantalla de pago", async () => {
    let registrada = false;
    const llamadas = servidor({
      "GET /api/auth/me": () =>
        registrada
          ? { estado: 200, cuerpo: yo() }
          : { estado: 401, cuerpo: { detail: "Se requiere sesión" } },
      "GET /api/planes": { estado: 200, cuerpo: PLANES },
      "POST /api/registro": () => {
        registrada = true;
        return { estado: 201, cuerpo: yo() };
      },
      "GET /api/mi-pago": { estado: 200, cuerpo: PAGO },
      "POST /api/mi-pago/qr": { estado: 200, cuerpo: { ...PAGO, qr: QR } },
    });
    abrir("/registro?plan=1");
    await screen.findByRole("heading", { level: 1, name: "Crear tu cuenta" });
    expect(screen.queryByLabelText(/estudiante/i)).toBeNull();
    expect((screen.getByLabelText("Plan") as HTMLSelectElement).value).toBe("1");
    llenar("Tu nombre", "Rosa Mendoza");
    llenar("Nombre de tu clase o estudio", "Clases de piano Rosa");
    llenar("Correo", "rosa@ejemplo.org");
    llenar("Teléfono", "+591 70000000");
    llenar(/^Usuario/, "rosa.mendoza");
    llenar(/^Contraseña/, "clave-segura-1");
    fireEvent.click(screen.getByLabelText(/Acepto los/));
    fireEvent.submit(screen.getByRole("form", { name: "Crear tu cuenta" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pago de tu plan" })).toBeDefined();
    expect(llamadas.find((l) => l.ruta === "POST /api/registro")?.cuerpo).toEqual({
      tipo: "independiente",
      nombre: "Rosa Mendoza",
      correo: "rosa@ejemplo.org",
      telefono: "+591 70000000",
      usuario: "rosa.mendoza",
      clave: "clave-segura-1",
      institucion: "Clases de piano Rosa",
      plan_id: 1,
      codigo_convenio: null,
      acepta_terminos: true,
    });
    // Sin precio en el QR generado al entrar: la pantalla pide el QR del monto del plan.
    expect(await screen.findByRole("img", { name: /QR simulado/ })).toBeDefined();
    expect(screen.getByText("Pago en verificación")).toBeDefined();
    expect(screen.getByText(/Bs 50,00 al mes/)).toBeDefined();
  });

  it("PU-web-46: con un código de convenio, el plan sale del convenio y el error del código se muestra", async () => {
    const llamadas = servidor({
      "GET /api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } },
      "GET /api/planes": { estado: 200, cuerpo: PLANES },
      "POST /api/registro": {
        estado: 422,
        cuerpo: { detail: "El código de convenio venció el 31/12/2025." },
      },
    });
    abrir("/registro");
    await screen.findByRole("heading", { level: 1, name: "Crear tu cuenta" });
    fireEvent.click(screen.getByLabelText("Represento a una institución"));
    llenar("Tu nombre", "Ana");
    llenar("Nombre de la institución", "Escuela");
    llenar("Correo", "ana@ejemplo.org");
    llenar("Teléfono", "70000000");
    llenar(/^Usuario/, "ana.p");
    llenar(/^Contraseña/, "clave-segura-1");
    fireEvent.click(screen.getByLabelText("Tengo un código de convenio"));
    expect((screen.getByLabelText("Plan") as HTMLSelectElement).disabled).toBe(true);
    llenar(/^Código de convenio/, "viejo-2025");
    fireEvent.click(screen.getByLabelText(/Acepto los/));
    fireEvent.submit(screen.getByRole("form", { name: "Crear tu cuenta" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "El código de convenio venció el 31/12/2025.",
    );
    const cuerpo = llamadas.find((l) => l.ruta === "POST /api/registro")?.cuerpo;
    expect(cuerpo).toMatchObject({
      tipo: "institucion",
      plan_id: null,
      codigo_convenio: "viejo-2025",
    });
  });

  it("PU-web-47: una cuenta pendiente de pago solo ve la pantalla de pago y Cerrar sesión", async () => {
    servidor({
      "GET /api/auth/me": { estado: 200, cuerpo: yo() },
      "GET /api/mi-pago": { estado: 200, cuerpo: { ...PAGO, monto_bs: null } },
    });
    abrir("/usuarios");
    expect(await screen.findByRole("heading", { level: 1, name: "Pago de tu plan" })).toBeDefined();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salir" })).toBeNull();
    expect(await screen.findByText("El monto de tu plan todavía no está definido")).toBeDefined();
    expect(screen.getByText("Bs —")).toBeDefined();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeDefined();
  });

  it("PU-web-48: el asistente del primer ingreso aparece con la institución vacía y se puede saltar", async () => {
    const activa = yo({ pago_pendiente: false });
    servidor({
      "GET /api/auth/me": { estado: 200, cuerpo: activa },
      "GET /api/instituciones/3/usuarios": {
        estado: 200,
        cuerpo: [
          {
            id: 7,
            usuario: "rosa.mendoza",
            nombre_visible: "Rosa Mendoza",
            es_menor: false,
            roles: ["admin_inst", "docente"],
          },
        ],
      },
      "GET /api/instituciones/3/asignaciones": { estado: 200, cuerpo: [] },
    });
    abrir("/usuarios");
    const asistente = await screen.findByRole("region", { name: "Asistente de primer ingreso" });
    expect(within(asistente).getByText("Paso 1 de 2")).toBeDefined();
    fireEvent.click(within(asistente).getByRole("button", { name: "Empezar" }));
    expect(await screen.findByRole("heading", { name: "Crea el primer estudiante" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Saltar este paso" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Usuarios" })).toBeDefined();
    expect(localStorage.getItem("skilltrack.asistente.7")).toBe("visto");
  });

  it("PU-web-50: con el banco, muestra el QR real, consulta cada 5 s y al pagarse entra a la app", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let pagado = false;
    const qrBanco = {
      ...QR,
      simulado: false,
      imagen_png: "iVBORw0KGgo=",
      vence_en: "2026-11-25T23:59:59-04:00",
    };
    const pendiente = { ...PAGO, proveedor: "baneco", qr: qrBanco };
    const llamadas = servidor({
      "GET /api/auth/me": () => ({ estado: 200, cuerpo: yo({ pago_pendiente: !pagado }) }),
      "GET /api/mi-pago": { estado: 200, cuerpo: pendiente },
      "POST /api/mi-pago/verificar": () => ({
        estado: 200,
        cuerpo: pagado
          ? { ...pendiente, estado: "activa", vence_plan: "2026-12-24", qr: null }
          : pendiente,
      }),
      "GET /api/instituciones/3/usuarios": { estado: 200, cuerpo: [] },
      "GET /api/instituciones/3/asignaciones": { estado: 200, cuerpo: [] },
    });
    try {
      abrir("/pago");
      const imagen = await screen.findByRole("img", {
        name: "Código QR para pagar Bs 50,00 al mes",
      });
      expect(imagen.getAttribute("src")).toBe("data:image/png;base64,iVBORw0KGgo=");
      expect(screen.getByText("Esperando el pago…")).toBeDefined();
      expect(screen.getByText("Vence el 25/11/2026.")).toBeDefined();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined();
      expect(screen.queryByRole("button", { name: "Ya pagué: verificar" })).toBeNull();

      await vi.advanceTimersByTimeAsync(5000);
      expect(llamadas.filter((l) => l.ruta === "POST /api/mi-pago/verificar")).toHaveLength(1);
      pagado = true;
      await vi.advanceTimersByTimeAsync(5000);
      // Institución vacía: entra al asistente del primer ingreso.
      expect(
        await screen.findByRole("region", { name: "Asistente de primer ingreso" }),
      ).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("PU-web-51: un QR vencido ofrece generar uno nuevo; si el banco no responde se avisa", async () => {
    const vencido = {
      ...PAGO,
      proveedor: "baneco",
      qr: { ...QR, simulado: false, estado: "vencido" },
    };
    servidor({
      "GET /api/auth/me": { estado: 200, cuerpo: yo() },
      "GET /api/mi-pago": { estado: 200, cuerpo: vencido },
      "POST /api/mi-pago/qr": {
        estado: 503,
        cuerpo: { detail: "No pudimos generar el QR. Intenta de nuevo en unos minutos." },
      },
    });
    abrir("/pago");
    expect(await screen.findByRole("heading", { name: "El QR venció" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Generar nuevo QR" }));
    expect(
      await screen.findByText("No pudimos generar el QR. Intenta de nuevo en unos minutos."),
    ).toBeDefined();
    expect(screen.getByText(/el superadministrador puede activar tu plan/)).toBeDefined();
  });

  it("PU-web-49: términos y privacidad están marcados pendientes de revisión legal", async () => {
    servidor({ "GET /api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } } });
    for (const [ruta, titulo] of [
      ["/terminos", "Términos y condiciones"],
      ["/privacidad", "Política de privacidad"],
    ] as const) {
      abrir(ruta);
      expect(await screen.findByRole("heading", { level: 1, name: titulo })).toBeDefined();
      expect(screen.getByText("Pendiente de revisión legal")).toBeDefined();
      cleanup();
    }
  });
});
