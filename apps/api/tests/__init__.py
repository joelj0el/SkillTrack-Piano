import os

# Las pruebas nunca llaman al banco: el proveedor es el simulado aunque exista un .env local. Se
# fija aquí, antes de importar app.main (que crea la aplicación al importarse).
os.environ["PAGOS_PROVEEDOR"] = "simulado"
os.environ["BANECO_AVISO_ACTIVO"] = "false"
os.environ["BANECO_AVISO_IPS"] = ""
