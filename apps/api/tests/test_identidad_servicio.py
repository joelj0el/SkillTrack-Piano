from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditoriaAcceso
from app.modules.identity import service
from app.modules.identity.models import SesionAuth
from tests import fabricas

T0 = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)


def test_pu_identity_03_el_hash_es_argon2id_y_verifica_la_clave():
    hash_guardado = service.hash_clave("una clave larga")

    assert hash_guardado.startswith("$argon2id$")
    assert service.verificar_clave(hash_guardado, "una clave larga")
    assert not service.verificar_clave(hash_guardado, "otra clave")


def test_pu_identity_04_la_sesion_guarda_solo_el_hash_del_token(db: Session):
    ana = fabricas.usuario(db, "ana")

    token = service.crear_sesion(db, ana, T0)

    guardada = db.scalars(select(SesionAuth)).one()
    assert guardada.id != token and len(guardada.id) == 64
    assert service.usuario_de_sesion(db, token, T0).id == ana.id


def test_pu_identity_05_la_sesion_expira_tras_30_dias_sin_actividad(db: Session):
    ana = fabricas.usuario(db, "ana")
    token = service.crear_sesion(db, ana, T0)

    assert service.usuario_de_sesion(db, token, T0 + timedelta(days=29)) is not None
    # La actividad del día 29 renueva el plazo.
    assert service.usuario_de_sesion(db, token, T0 + timedelta(days=58)) is not None
    assert service.usuario_de_sesion(db, token, T0 + timedelta(days=89)) is None


def test_pu_identity_06_revocar_invalida_la_sesion(db: Session):
    ana = fabricas.usuario(db, "ana")
    token = service.crear_sesion(db, ana, T0)

    service.revocar_sesion(db, token)

    assert service.usuario_de_sesion(db, token, T0) is None


def test_pu_identity_07_cinco_fallos_en_15_min_bloquean_15_min(db: Session):
    ana = fabricas.usuario(db, "ana")
    for minuto in range(5):
        with pytest.raises(service.CredencialesInvalidas):
            service.autenticar(db, "ana", "mala", T0 + timedelta(minutes=minuto))

    with pytest.raises(service.UsuarioBloqueado):
        service.autenticar(db, "ana", fabricas.CLAVE, T0 + timedelta(minutes=5))
    acciones = db.scalars(
        select(AuditoriaAcceso.accion).where(AuditoriaAcceso.recurso_id == ana.id)
    ).all()
    assert acciones.count("login_fallido") == 5 and "login_bloqueado" in acciones

    # Pasados 15 min desde el quinto fallo, la clave correcta vuelve a funcionar.
    assert service.autenticar(db, "ana", fabricas.CLAVE, T0 + timedelta(minutes=19, seconds=1))


def test_pu_identity_08_usuario_inexistente_y_clave_mala_dan_el_mismo_error(db: Session):
    fabricas.usuario(db, "ana")

    with pytest.raises(service.CredencialesInvalidas):
        service.autenticar(db, "nadie", "x", T0)
    with pytest.raises(service.CredencialesInvalidas):
        service.autenticar(db, "ana", "x", T0)


def test_pu_identity_09_la_clave_temporal_no_tiene_caracteres_ambiguos():
    clave = service.generar_clave_temporal()

    assert len(clave) == 10
    assert not set(clave) & set("0O1lI")


def test_pu_identity_10_cambiar_clave_quita_la_marca_temporal(db: Session):
    ana = fabricas.usuario(db, "ana", clave_temporal=True)

    service.cambiar_clave(db, ana, fabricas.CLAVE, "nueva-clave-larga")

    assert not ana.clave_temporal
    assert service.verificar_clave(ana.hash_clave, "nueva-clave-larga")
    with pytest.raises(ValueError):
        service.cambiar_clave(db, ana, "nueva-clave-larga", "nueva-clave-larga")
