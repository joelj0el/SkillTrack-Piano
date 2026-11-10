import { useId, type ReactNode } from "react";

/** Motivo de marca: una octava corta de teclas. Decorativo en todos los usos. */
export function LogoTeclas() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect className="ilu-blanca" x="3" y="4" width="8.6" height="24" rx="1.5" />
      <rect className="ilu-blanca" x="11.7" y="4" width="8.6" height="24" rx="1.5" />
      <rect className="ilu-blanca" x="20.4" y="4" width="8.6" height="24" rx="1.5" />
      <rect className="ilu-negra" x="8.8" y="4" width="5.6" height="15" rx="1" />
      <rect className="ilu-negra" x="17.6" y="4" width="5.6" height="15" rx="1" />
    </svg>
  );
}

/** Tira de teclas bajo la barra superior. */
export function TiraTeclas() {
  const id = useId();
  const blancas = [0, 10, 20, 30, 40, 50, 60];
  const negras = [7, 17, 37, 47, 57];
  return (
    <svg className="tira-teclas" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="70" height="12" patternUnits="userSpaceOnUse">
          {blancas.map((x) => (
            <rect key={x} className="ilu-tira-blanca" x={x} width="10" height="12" />
          ))}
          {negras.map((x) => (
            <rect key={x} className="ilu-tira-negra" x={x} width="6" height="7" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function Teclado({ encendidas = [], children }: { encendidas?: number[]; children?: ReactNode }) {
  const blancas = [0, 1, 2, 3, 4, 5, 6];
  const negras = [0, 1, 3, 4, 5];
  return (
    <svg className="estado-ilustracion" viewBox="0 0 120 96" aria-hidden="true">
      {blancas.map((i) => (
        <rect
          key={i}
          className={encendidas.includes(i) ? "ilu-activa" : "ilu-blanca"}
          x={11 + i * 14}
          y="36"
          width="14"
          height="52"
          rx="2"
        />
      ))}
      {negras.map((i) => (
        <rect key={i} className="ilu-negra" x={20 + i * 14} y="36" width="9" height="32" rx="1.5" />
      ))}
      {children}
    </svg>
  );
}

export const IlustracionVacio = () => (
  <Teclado>
    <path className="ilu-trazo" d="M52 24V8l18-4v16" />
    <circle className="ilu-trazo" cx="47" cy="24" r="5" />
    <circle className="ilu-trazo" cx="65" cy="20" r="5" />
  </Teclado>
);

export const IlustracionError = () => (
  <Teclado encendidas={[3]}>
    <path className="ilu-trazo" d="M60 6 44 30h32ZM60 15v7M60 26v.5" />
  </Teclado>
);

export const IlustracionSinConexion = () => (
  <Teclado>
    <path
      className="ilu-trazo"
      d="M38 20a30 30 0 0 1 44 0M47 28a18 18 0 0 1 26 0M60 6 80 30M56 32h8"
    />
  </Teclado>
);

export const IlustracionNoEvaluable = () => (
  <Teclado>
    <path
      className="ilu-trazo"
      d="M38 18s8-12 22-12 22 12 22 12-8 12-22 12-22-12-22-12ZM42 30 78 4"
    />
    <circle className="ilu-trazo" cx="60" cy="18" r="5" />
  </Teclado>
);

/** Teclado con teclas iluminadas: ejemplo para la galería, en lugar de la cámara. */
export const TecladoEjemplo = () => <Teclado encendidas={[1, 4]} />;
