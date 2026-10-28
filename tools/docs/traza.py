# /// script
# requires-python = "==3.12.*"
# dependencies = []
# ///
"""docs:trace it-N — genera n8-trazabilidad.generado.md (SP → OE → HU → componente → prueba)."""

import re
import sys

# La consola de Windows no usa UTF-8 por defecto.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

if len(sys.argv) != 2 or not re.fullmatch(r"it-\d+", sys.argv[1]):
    sys.exit("Uso: pnpm docs:trace it-N  (por ejemplo: pnpm docs:trace it-1)")

print(
    f"docs:trace {sys.argv[1]} — pendiente: se implementa en P-06 (no se generó ningún archivo)."
)
