from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditoriaAcceso
from tests import escenario
from tests.conftest import Reloj, como, entrar


def _nuevo(usuario: str, **extra) -> dict:
    return {
        "usuario": usuario,
        "nombre_visible": usuario.title(),
        "es_menor": True,
        "rol": "estudiante",
        **extra,
    }


def test_pa_hu31_01_estudiante_menor_sin_correo_entra_con_la_clave_temporal(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    respuesta = como(cliente, e.admin_a).post(
        f"/api/instituciones/{e.inst_a.id}/usuarios", json=_nuevo("lucia.menor")
    )
    assert respuesta.status_code == 201
    clave = respuesta.json()["clave_temporal"]

    cliente.cookies.clear()
    entrar(cliente, "lucia.menor", clave)
    yo = cliente.get("/api/auth/me").json()
    assert yo["clave_temporal"] is True
    # Con la clave temporal no puede usar otras pantallas (PA-HU01-02).
    assert cliente.get("/api/mis-estudiantes").status_code == 403
    # La clave temporal no se vuelve a mostrar: el listado no la incluye.
    listado = como(cliente, e.admin_a).get(f"/api/instituciones/{e.inst_a.id}/usuarios").text
    assert clave not in listado


def test_pa_hu31_02_usuario_duplicado_409_y_correo_invalido_422(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    como(cliente, e.admin_a)
    ruta = f"/api/instituciones/{e.inst_a.id}/usuarios"

    assert cliente.post(ruta, json=_nuevo("estudiante.a")).status_code == 409
    assert cliente.post(ruta, json=_nuevo("con.correo", email="mal-correo")).status_code == 422
    assert cliente.post(ruta, json=_nuevo("con.correo", email="ok@uab.edu.bo")).status_code == 201


def test_pa_hu31_03_al_cerrar_la_asignacion_el_docente_deja_de_ver_al_estudiante(
    cliente: TestClient, db: Session, reloj: Reloj
):
    e = escenario.crear(db)
    como(cliente, e.admin_a)
    asignacion = cliente.post(
        f"/api/instituciones/{e.inst_a.id}/asignaciones",
        json={"docente_id": e.docente_a2.id, "estudiante_id": e.estudiante_a2.id},
    ).json()

    como(cliente, e.docente_a2)
    assert [x["id"] for x in cliente.get("/api/mis-estudiantes").json()] == [e.estudiante_a2.id]
    assert cliente.get(f"/api/estudiantes/{e.estudiante_a2.id}").status_code == 200

    como(cliente, e.admin_a).post(
        f"/api/instituciones/{e.inst_a.id}/asignaciones/{asignacion['id']}/cerrar"
    )

    como(cliente, e.docente_a2)
    assert cliente.get("/api/mis-estudiantes").json() == []
    assert cliente.get(f"/api/estudiantes/{e.estudiante_a2.id}").status_code == 403


def test_pa_hu31_04_usuarios_de_otra_institucion_reciben_403(cliente: TestClient, db: Session):
    e = escenario.crear(db)
    a = e.inst_a.id
    rutas = [
        ("get", f"/api/instituciones/{a}/usuarios", None),
        ("post", f"/api/instituciones/{a}/usuarios", _nuevo("intruso")),
        ("get", f"/api/instituciones/{a}/asignaciones", None),
        (
            "post",
            f"/api/instituciones/{a}/asignaciones",
            {"docente_id": e.docente_a.id, "estudiante_id": e.estudiante_a2.id},
        ),
        ("post", f"/api/instituciones/{a}/asignaciones/1/cerrar", None),
    ]
    for ajeno in (e.docente_b, e.estudiante_b, e.admin_b, e.docente_a, e.estudiante_a):
        como(cliente, ajeno)
        for metodo, ruta, cuerpo in rutas:
            respuesta = cliente.request(metodo, ruta, json=cuerpo)
            assert respuesta.status_code == 403, (ajeno.username, metodo, ruta)


def test_pa_hu31_05_restablecer_clave_revoca_sesiones_y_queda_auditado(
    cliente: TestClient, db: Session
):
    e = escenario.crear(db)
    sesion_estudiante = TestClient(
        cliente.app, base_url="https://testserver", headers={"x-skilltrack-csrf": "1"}
    )
    entrar(sesion_estudiante, e.estudiante_a.username)
    assert sesion_estudiante.get("/api/auth/me").status_code == 200

    for autorizado in (e.admin_a, e.docente_a):
        respuesta = como(cliente, autorizado).post(
            f"/api/estudiantes/{e.estudiante_a.id}/restablecer-clave"
        )
        assert respuesta.status_code == 200
    assert sesion_estudiante.get("/api/auth/me").status_code == 401

    nueva = respuesta.json()["clave_temporal"]
    cliente.cookies.clear()
    entrar(cliente, e.estudiante_a.username, nueva)
    assert cliente.get("/api/auth/me").json()["clave_temporal"] is True

    registros = db.scalars(
        select(AuditoriaAcceso).where(AuditoriaAcceso.accion == "restablecer_clave")
    ).all()
    assert {(r.actor_id, r.recurso, r.recurso_id) for r in registros} == {
        (e.admin_a.id, "estudiante", e.estudiante_a.id),
        (e.docente_a.id, "estudiante", e.estudiante_a.id),
    }
    assert all(r.fecha is not None for r in registros)

    for ajeno in (e.docente_a2, e.docente_b, e.admin_b):
        respuesta = como(cliente, ajeno).post(
            f"/api/estudiantes/{e.estudiante_a.id}/restablecer-clave"
        )
        assert respuesta.status_code == 403, ajeno.username
