# Versión de avance — Iteración 3 (rama `entrega/it-3`)

Incluye la It-1 y la It-2 (ver sus README) más el **núcleo de audio**: detección de ataques, tempo y regularidad, clase de altura, metrónomo, puerta acústica y dedo atribuido por ataque. No se fusiona a `main`.

## Levantar el sistema

Igual que en la It-1 y la It-2:

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up --build
```

En esta versión el audio todavía no se captura en el navegador: la aplicación se ve igual que en la It-2.

## Qué mostrar

El núcleo de audio se demuestra con sus pruebas sobre señales sintéticas:

```bash
pnpm vitest run packages/core/src/audio packages/core/src/calidad packages/core/src/alineacion
```

1. **Ataques** (PU-audio-05 y 09): escalas sintéticas a ♩ = 60 y 75, cada ataque recuperado con error ≤ 10 ms, también en el registro grave.
2. **Tempo** (PU-audio-10 a 15): estable, aceleraste o frenaste; solo la nota retrasada se marca como tropiezo; la referencia cambia con el modo de metrónomo.
3. **Notas** (PU-audio-17 a 20): las cuatro escalas del repertorio se verifican; la nota equivocada se marca y la débil queda "dudosa".
4. **Metrónomo y micrófono** (PU-tempo, PU-quality-06 a 09).

## Estado de esta versión

| Elemento                                             | Estado       | Motivo                                         |
| ---------------------------------------------------- | ------------ | ---------------------------------------------- |
| Núcleo de audio y fusión simple                      | Implementado | Con señales sintéticas                         |
| Captura de audio, pantallas de micrófono y metrónomo | Pendiente    | Recortado por tiempo                           |
| Alineamiento con la partitura, desfase entre manos   | Pendiente    | Requiere la partitura transcrita y el detector |
| Avance de la tarea (HU-37)                           | No incluido  | —                                              |
