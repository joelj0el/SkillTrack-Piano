from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditoriaAcceso
from tests import fabricas
from tests.conftest import Reloj, entrar


def test_pa_hu01_04_cinco_fallos_bloquean_con_429_y_quedan_auditados(
    cliente: TestClient, db: Session, reloj: Reloj
):
    ana = fabricas.usuario(db, "ana")
    for _ in range(5):
        respuesta = cliente.post("/api/auth/login", json={"usuario": "ana", "clave": "mala"})
        assert respuesta.status_code == 401
        reloj.avanzar(minutes=1)

    bloqueado = cliente.post("/api/auth/login", json={"usuario": "ana", "clave": fabricas.CLAVE})
    assert bloqueado.status_code == 429
    # El quinto fallo fue en el minuto 4: el bloqueo sigue en el minuto 18 y termina en el 19.
    reloj.avanzar(minutes=13)
    assert (
        cliente.post(
            "/api/auth/login", json={"usuario": "ana", "clave": fabricas.CLAVE}
        ).status_code
        == 429
    )
    reloj.avanzar(minutes=1, seconds=1)
    assert (
        cliente.post(
            "/api/auth/login", json={"usuario": "ana", "clave": fabricas.CLAVE}
        ).status_code
        == 200
    )

    acciones = db.scalars(
        select(AuditoriaAcceso.accion).where(AuditoriaAcceso.recurso_id == ana.id)
    ).all()
    assert "login_bloqueado" in acciones


def test_pa_hu01_05_cookie_segura_sin_token_en_el_cuerpo_y_csrf(
    cliente: TestClient, db: Session, reloj: Reloj
):
    fabricas.usuario(db, "ana")
    respuesta = cliente.post("/api/auth/login", json={"usuario": "ana", "clave": fabricas.CLAVE})

    cookie = respuesta.headers["set-cookie"].lower()
    assert "httponly" in cookie and "secure" in cookie and "samesite=lax" in cookie
    token = respuesta.cookies["sesion"]
    assert token not in respuesta.text

    sin_csrf = cliente.post(
        "/api/auth/cambiar-clave",
        json={"clave_actual": fabricas.CLAVE, "clave_nueva": "otra-clave-larga"},
        headers={"x-skilltrack-csrf": ""},
    )
    assert sin_csrf.status_code == 403

    reloj.avanzar(days=31)
    assert cliente.get("/api/auth/me").status_code == 401


def test_pa_hu01_05_tras_logout_la_misma_cookie_recibe_401(cliente: TestClient, db: Session):
    fabricas.usuario(db, "ana")
    entrar(cliente, "ana")
    cookie = cliente.cookies["sesion"]

    assert cliente.post("/api/auth/logout").status_code == 204
    cliente.cookies.set("sesion", cookie, domain="testserver", path="/api")
    assert cliente.get("/api/auth/me").status_code == 401


def test_pu_identity_11_el_mensaje_de_error_no_dice_que_fallo(cliente: TestClient, db: Session):
    fabricas.usuario(db, "ana")

    sin_usuario = cliente.post("/api/auth/login", json={"usuario": "nadie", "clave": "x"})
    clave_mala = cliente.post("/api/auth/login", json={"usuario": "ana", "clave": "x"})

    assert sin_usuario.status_code == clave_mala.status_code == 401
    assert sin_usuario.json() == clave_mala.json() == {"detail": "Usuario o contraseña incorrectos"}


def test_pu_identity_12_con_clave_temporal_solo_puede_cambiarla(cliente: TestClient, db: Session):
    fabricas.usuario(db, "ana", clave_temporal=True)
    entrar(cliente, "ana")

    assert cliente.get("/api/auth/me").json()["clave_temporal"] is True
    corta = cliente.post(
        "/api/auth/cambiar-clave", json={"clave_actual": fabricas.CLAVE, "clave_nueva": "corta"}
    )
    assert corta.status_code == 422
    assert (
        cliente.post(
            "/api/auth/cambiar-clave",
            json={"clave_actual": fabricas.CLAVE, "clave_nueva": "una-clave-nueva"},
        ).status_code
        == 204
    )
    assert cliente.get("/api/auth/me").json()["clave_temporal"] is False
