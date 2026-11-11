// Ejecuta un comando impidiendo que el equipo entre en espera mientras dura.
// Uso: node tools/despierto.ts <script.js> [argumentos…]   (el script corre con este mismo Node)
// En Windows, la espera moderna suspende el navegador a mitad de una prueba: la prueba "dura"
// tanto como la espera y su límite de tiempo no la corta. Fuera de Windows solo ejecuta el comando.
import { spawn } from "node:child_process";
import { resolve } from "node:path";

/** ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED (2147483651). */
export const ESTADO_DESPIERTO = 0x80000003;

/** Guion de PowerShell que mantiene el pedido mientras exista el proceso indicado. */
export function guardianWindows(pid: number): string {
  return [
    "Add-Type -Namespace Despierto -Name Energia -MemberDefinition",
    "'[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint e);';",
    `while (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) {`,
    "[Despierto.Energia]::SetThreadExecutionState([uint32]2147483651) | Out-Null; Start-Sleep -Seconds 20 }",
  ].join(" ");
}

function principal(): void {
  const [comando, ...argumentos] = process.argv.slice(2);
  if (!comando) {
    console.error("Uso: node tools/despierto.ts <script.js> [argumentos…]");
    process.exit(2);
  }
  const hijo = spawn(process.execPath, [comando, ...argumentos], { stdio: "inherit" });
  const guardian =
    process.platform === "win32"
      ? spawn("powershell", ["-NoProfile", "-Command", guardianWindows(process.pid)], {
          stdio: "ignore",
        })
      : null;
  hijo.on("exit", (codigo, senal) => {
    guardian?.kill();
    process.exit(codigo ?? (senal ? 1 : 0));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) principal();
