"""Cifrado AES-256-CBC que pide la API del Banco Económico, hecho en local.

La llave son los 32 caracteres de BANECO_LLAVE_AES en UTF-8; el IV (16 bytes aleatorios) va
antepuesto al cifrado; relleno PKCS7; el resultado, en Base64. Nunca se usan los servicios de
cifrado del banco: enviarían la llave en la URL.
"""

import base64
import os

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

_BLOQUE = 128


def _llave(llave: str) -> bytes:
    datos = llave.encode("utf-8")
    if len(datos) != 32:
        raise ValueError("La llave AES debe tener 32 bytes.")
    return datos


def cifrar(texto: str, llave: str) -> str:
    iv = os.urandom(16)
    relleno = padding.PKCS7(_BLOQUE).padder()
    datos = relleno.update(texto.encode("utf-8")) + relleno.finalize()
    cifrador = Cipher(algorithms.AES(_llave(llave)), modes.CBC(iv)).encryptor()
    return base64.b64encode(iv + cifrador.update(datos) + cifrador.finalize()).decode("ascii")


def descifrar(cifrado: str, llave: str) -> str:
    datos = base64.b64decode(cifrado)
    iv, cuerpo = datos[:16], datos[16:]
    descifrador = Cipher(algorithms.AES(_llave(llave)), modes.CBC(iv)).decryptor()
    con_relleno = descifrador.update(cuerpo) + descifrador.finalize()
    quitar = padding.PKCS7(_BLOQUE).unpadder()
    return (quitar.update(con_relleno) + quitar.finalize()).decode("utf-8")
