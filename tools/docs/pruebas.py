# /// script
# requires-python = "==3.12.*"
# dependencies = []
# ///
"""docs:tests it-N — genera n6-pruebas.generado.md desde las tarjetas y los reportes JUnit."""

import re
import sys

# La consola de Windows no usa UTF-8 por defecto.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

if len(sys.argv) != 2 or not re.fullmatch(r"it-\d+", sys.argv[1]):
    sys.exit("Uso: pnpm docs:tests it-N  (por ejemplo: pnpm docs:tests it-1)")

print(
    f"docs:tests {sys.argv[1]} — pendiente: se implementa en P-06 (no se generó ningún archivo)."
)
