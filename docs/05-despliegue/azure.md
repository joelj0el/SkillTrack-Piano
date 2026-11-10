# Despliegue en Azure, paso a paso

Esta guía deja la aplicación en una máquina virtual de Azure for Students, con HTTPS público, y la actualiza con un solo botón desde GitHub.

| Pieza                         | Dónde está                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| Máquina virtual (Caddy y API) | Azure, Ubuntu 24.04 LTS                                           |
| Base de datos                 | Azure Database for PostgreSQL, servidor flexible                  |
| Imágenes                      | GitHub Container Registry (GHCR), una por commit desplegado       |
| Archivos de producción        | `infra/docker-compose.prod.yml` e `infra/Caddyfile.prod`          |
| Botón de despliegue           | `.github/workflows/deploy.yml` (pestaña Actions → **Despliegue**) |

La privacidad no cambia: el servidor solo recibe números y textos, nunca video, audio ni imágenes.

## 1. Clave SSH para el despliegue

En tu PC, crea una clave solo para el despliegue:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\skilltrack-despliegue -C "despliegue skilltrack"
```

Se crean dos archivos: `skilltrack-despliegue` (privada, no se comparte) y `skilltrack-despliegue.pub` (pública).

## 2. Máquina virtual

En el portal de Azure: **Máquinas virtuales → Crear**.

1. Imagen: **Ubuntu Server 24.04 LTS**.
2. Tamaño: uno de 1 GB de memoria (por ejemplo, B1s). La API está pensada para caber ahí (R-20). Revisa en el portal el costo contra tu crédito de estudiante.
3. Autenticación: **clave pública SSH**. Usuario: `skilltrack`. Pega el contenido de `skilltrack-despliegue.pub`.
4. Puertos de entrada: **22, 80 y 443**.
5. Cuando esté creada: **Información general → Nombre DNS → Configurar**, y elige una etiqueta. Tu dominio será `<etiqueta>.<región>.cloudapp.azure.com`. Anótalo: es el `DOMINIO`.

Te recomiendo restringir el puerto 22 a tu IP en el grupo de seguridad de red. GitHub Actions también entra por SSH, así que si lo restringes tendrás que abrirlo durante cada despliegue.

## 3. Base de datos

En el portal: **Azure Database for PostgreSQL → Servidor flexible → Crear**.

1. Versión: **17**. Nivel: **Burstable**, el más pequeño. Revisa el costo en el portal.
2. Usuario administrador y contraseña: anótalos.
3. Redes: **acceso público**, y agrega una regla para la IP pública de la máquina virtual.
4. Cuando esté creado: **Bases de datos → Agregar**, con el nombre `skilltrack`.

La cadena de conexión queda así (el servicio exige TLS):

```text
postgresql+psycopg://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/skilltrack?sslmode=require
```

## 4. Preparar la máquina virtual

Entra desde tu PC:

```powershell
ssh -i $HOME\.ssh\skilltrack-despliegue skilltrack@<DOMINIO>
```

Dentro de la máquina virtual:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker skilltrack
exit
```

Vuelve a entrar (para que el grupo `docker` se aplique) y crea la carpeta de la aplicación:

```bash
sudo mkdir -p /opt/skilltrack && sudo chown skilltrack: /opt/skilltrack
nano /opt/skilltrack/.env
```

Pega el contenido de `infra/produccion.env.example` y completa `IMAGENES` (tu usuario y el repositorio, en minúsculas), `DOMINIO`, `CORREO_ACME` y `DATABASE_URL`. Deja `ETIQUETA` vacía: el despliegue la completa.

Las imágenes de GHCR son privadas. Crea en GitHub un token clásico con el permiso `read:packages` (**Settings → Developer settings → Personal access tokens**) e inicia sesión una vez en la máquina virtual:

```bash
echo <TOKEN> | docker login ghcr.io -u <tu-usuario-de-github> --password-stdin
```

## 5. Secretos en GitHub

En el repositorio: **Settings → Secrets and variables → Actions**.

| Tipo     | Nombre        | Valor                                                                   |
| -------- | ------------- | ----------------------------------------------------------------------- |
| Secreto  | `SSH_HOST`    | El `DOMINIO`                                                            |
| Secreto  | `SSH_USUARIO` | `skilltrack`                                                            |
| Secreto  | `SSH_CLAVE`   | El contenido completo de `skilltrack-despliegue` (la clave **privada**) |
| Secreto  | `SSH_HUELLA`  | La salida de `ssh-keyscan -t ed25519 <DOMINIO>`, ejecutado desde tu PC  |
| Variable | `DOMINIO`     | El `DOMINIO`                                                            |

`SSH_HUELLA` permite que GitHub compruebe que se conecta a tu máquina virtual y no a otra.

## 6. Desplegar con el botón

1. Pestaña **Actions → Despliegue → Run workflow**, sobre la rama `main`.
2. El flujo construye las imágenes del commit, las publica en GHCR, copia los archivos de producción, aplica las migraciones, levanta la versión nueva y comprueba `https://<DOMINIO>/api/health`.
3. La primera vez, Caddy obtiene el certificado de Let's Encrypt: puede tardar un minuto.

Abre `https://<DOMINIO>` en el teléfono: el certificado es público, así que no aparece ninguna advertencia y la app se puede instalar.

## 7. Revisar y volver atrás

En la máquina virtual, dentro de `/opt/skilltrack`:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail 100
```

Para volver a una versión anterior, cambia `ETIQUETA` en `.env` por el commit anterior y ejecuta `docker compose -f docker-compose.prod.yml up -d`. Las migraciones no se deshacen solas: si la versión nueva cambió la base de datos, revisa antes la migración.

## 8. Primer usuario

Pendiente: la API todavía no tiene un comando para crear el primer administrador en producción.

Para una demostración puedes cargar una vez los datos ficticios de prueba. Usa una contraseña propia, no la del entorno local:

```bash
docker compose -f docker-compose.prod.yml run --rm -e SEMILLA_DEMO=1 -e SEMILLA_CLAVE=<clave> api python -m app.semilla
```

Esos usuarios son ficticios y solo sirven para la demostración. No los uses para datos reales.
