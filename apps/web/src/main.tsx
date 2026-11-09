import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.tsx";
import "./design/base.css";
import { ProveedorSesion } from "./sesion.tsx";
import { aplicarTema, temaGuardado } from "./tema.ts";

aplicarTema(temaGuardado());

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("No existe el elemento #raiz");

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
