# Versión de avance — Iteración 1 (rama `entrega/it-1`)

Tareas y observaciones del docente (OE1) sobre una PWA instalable con inicio de sesión por rol. Esta rama es una versión de avance: no se fusiona a `main`.

## Levantar el sistema

Requisitos: Docker Desktop. Desde la raíz del repositorio:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Abre <https://localhost> y acepta el certificado local (o confía en la CA de Caddy como explica el README principal). La API aplica sus migraciones y crea los datos de demostración al arrancar.

| Usuario             | Rol           | Pantalla inicial   |
| ------------------- | ------------- | ------------------ |
| `admin.demo`        | Administrador | Usuarios           |
| `docente.demo`      | Docente       | Mis estudiantes    |
| `estudiante.demo`   | Estudiante    | Mis tareas         |
| `investigador.demo` | Investigador  | Modo investigación |

Contraseña de los cuatro: la de `SEMILLA_CLAVE` (por defecto `demo-piano-2026`, solo para el entorno local). Para empezar de cero: `docker compose -f infra/docker-compose.yml down -v`.

## Probar desde un teléfono Android

1. Conecta la laptop y el teléfono a la misma red y averigua la IP de la laptop (`ipconfig`, por ejemplo `192.168.1.20`).
2. Levanta el sistema con esa IP: `DOMINIO=192.168.1.20 docker compose -f infra/docker-compose.yml up --build` (en PowerShell: `$env:DOMINIO="192.168.1.20"; docker compose -f infra/docker-compose.yml up --build`).
3. Permite los puertos 80 y 443 en el firewall de Windows si lo pide.
4. Exporta la CA local: `docker compose -f infra/docker-compose.yml cp web:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt` (fuera del repositorio o bórrala después) y pásala al teléfono.
5. En Android: Ajustes → Seguridad → Cifrado y credenciales → Instalar un certificado → Certificado de CA.
6. Abre `https://192.168.1.20` en Chrome, inicia sesión y usa "Instalar app" en el menú.

Sin el paso 5 la app abre, pero Chrome no registra el _service worker_ ni ofrece instalarla.

## Qué mostrar (unos 5 minutos)

1. **Administrador** (`admin.demo`): crear un estudiante menor de edad sin correo; la clave temporal aparece una sola vez. Asignarlo a `docente.demo`.
2. **Estudiante nuevo**: entrar con la clave temporal; la app obliga a cambiarla antes de mostrar nada más.
3. **Docente** (`docente.demo`): en "Mis estudiantes", abrir al estudiante y asignar EJ-01 a manos juntas, ♩ = 60–70, plazo a 7 días y 3 repeticiones; registrar una observación con el aspecto "Desfase rítmico".
4. **Estudiante**: "Mis tareas" muestra la tarea con sus 5 datos; al abrirla, la observación con fecha y aspecto; desde ahí, el detalle del ejercicio.
5. **Seguridad**: con otro docente, intentar abrir la URL del estudiante → acceso denegado; cinco claves erróneas seguidas → bloqueo de 15 minutos.
6. **Sin conexión**: con la app abierta, desactivar la red y recargar → la app abre y las secciones muestran "Sin conexión".

## Pruebas

```bash
pnpm test                                  # Vitest
uv run --project apps/api pytest           # API contra PostgreSQL real (Docker)
pnpm e2e                                   # Playwright contra https://localhost (sistema levantado)
```

Resultados y estado de cada criterio: `n2-requerimientos.md` y `n6-pruebas.generado.md`.

## Estado de esta versión

| Elemento                                                 | Estado       | Motivo                                                                   |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| Inicio de sesión, administración, tareas y observaciones | Implementado | Con pruebas de aceptación automáticas                                    |
| PWA instalable y sin conexión                            | Implementado | Verificado en Chromium; falta la prueba manual en el Android y el iPhone |
| Catálogo                                                 | Prototipo    | Partitura y digitación pendientes de transcripción                       |
| Aspecto visual                                           | Prototipo    | Tokens de diseño provisionales                                           |
| Despliegue en la nube                                    | Pendiente    | Esta versión se ejecuta en local                                         |
