---
id: HU-14
titulo: Asignar tareas y registrar observaciones
oe: OE1
sp: SP1
iteracion: it-1
prioridad: Must
puntos: 5
estado: pendiente   # pendiente | en-curso | terminada | aceptada
componentes: [pedagogy, pedagogy-ui]
tablas: [tarea, observacion]
criterios:
  - id: PA-HU14-01
    tipo: auto-e2e
    texto: "Dado un docente con un estudiante asignado, cuando asigna el ejercicio E1 a 60 bpm con plazo, entonces el estudiante ve la tarea en 'Mis tareas'."
  - id: PA-HU14-02
    tipo: auto-api
    texto: "Dado un docente sin asignación vigente con el estudiante, cuando intenta crearle una tarea, entonces recibe 403 y se registra en auditoría."
  - id: PA-HU14-03
    tipo: manual
    texto: "Dado un docente del panel en su teléfono, cuando registra una observación, entonces el estudiante la encuentra en menos de 3 toques."
tareas:   # copiadas de docs/PLAN_DE_TAREAS.md; el estado se actualiza al terminar cada tarea
  - id: TI-HU14-01
    texto: "Modelos tarea y observacion + migración + contratos"
    estado: pendiente   # pendiente | en-curso | hecha
  - id: TI-HU14-02
    texto: "Servicio y endpoints del docente + auditoría (PA-HU14-02)"
    estado: pendiente
  - id: TI-HU14-03
    texto: "Pantallas del docente (PA-HU14-01)"
    estado: pendiente
---
**Como** docente **quiero** asignar ejercicios y dejar observaciones a mis estudiantes **para** que no se pierdan las indicaciones entre clases.

**Notas del panel:** …
**Fuera de alcance:** chat, adjuntos.
