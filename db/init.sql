-- Seed de datos mínimos para SkillTrack Piano
--
-- Este script se monta en /docker-entrypoint-initdb.d/ y Postgres lo ejecuta
-- UNA SOLA VEZ, al crear el volumen de datos por primera vez — es decir, ANTES
-- de que existan las tablas (estas las crea `alembic upgrade head`, ver README).
-- Por eso todo el contenido va envuelto en un bloque que comprueba si las tablas
-- ya existen: si no existen (primer arranque), no hace nada y no falla el
-- contenedor. Tras aplicar las migraciones, vuelve a ejecutarse manualmente:
--
--   docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB -f /docker-entrypoint-initdb.d/init.sql
--
-- (ver sección "Levantar el entorno" del README).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF to_regclass('public.exercises') IS NULL THEN
        RAISE NOTICE 'Tablas aún no creadas (falta alembic upgrade head) — omitiendo seed por ahora.';
        RETURN;
    END IF;

    -- Roles base del sistema
    INSERT INTO roles (id, name) VALUES
        (uuid_generate_v4(), 'student'),
        (uuid_generate_v4(), 'teacher'),
        (uuid_generate_v4(), 'institution_admin'),
        (uuid_generate_v4(), 'admin')
    ON CONFLICT (name) DO NOTHING;

    -- Institución demo
    INSERT INTO institutions (id, name, city, created_at)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Conservatorio Demo Cochabamba', 'Cochabamba', now())
    ON CONFLICT (id) DO NOTHING;

    -- Usuario docente demo (contraseña: demo1234)
    INSERT INTO users (id, email, hashed_password, full_name, role_id, institution_id, is_active, created_at, updated_at)
    SELECT
        '22222222-2222-2222-2222-222222222222',
        'demo@docente.com',
        '$2b$12$oww5pUv/M6L566USAHF1neeGH3BKs9DKb/5jTjFCZ3QMGzzYphYAW',
        'Docente Demo',
        r.id,
        '11111111-1111-1111-1111-111111111111',
        true,
        now(),
        now()
    FROM roles r WHERE r.name = 'teacher'
    ON CONFLICT (id) DO NOTHING;

    -- Usuario estudiante demo (contraseña: demo1234)
    INSERT INTO users (id, email, hashed_password, full_name, role_id, institution_id, is_active, created_at, updated_at)
    SELECT
        '33333333-3333-3333-3333-333333333333',
        'demo@estudiante.com',
        '$2b$12$oww5pUv/M6L566USAHF1neeGH3BKs9DKb/5jTjFCZ3QMGzzYphYAW',
        'Estudiante Demo',
        r.id,
        '11111111-1111-1111-1111-111111111111',
        true,
        now(),
        now()
    FROM roles r WHERE r.name = 'student'
    ON CONFLICT (id) DO NOTHING;

    -- Usuario administrador demo (contraseña: demo1234)
    INSERT INTO users (id, email, hashed_password, full_name, role_id, institution_id, is_active, created_at, updated_at)
    SELECT
        '77777777-7777-7777-7777-777777777777',
        'demo@admin.com',
        '$2b$12$oww5pUv/M6L566USAHF1neeGH3BKs9DKb/5jTjFCZ3QMGzzYphYAW',
        'Administrador Demo',
        r.id,
        '11111111-1111-1111-1111-111111111111',
        true,
        now(),
        now()
    FROM roles r WHERE r.name = 'admin'
    ON CONFLICT (id) DO NOTHING;

    -- Relación docente-estudiante
    INSERT INTO teacher_student (teacher_id, student_id, created_at)
    VALUES ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', now())
    ON CONFLICT DO NOTHING;

    -- Ejercicio demo: escala de Do mayor, una mano, 60 bpm
    INSERT INTO exercises (id, title, description, difficulty_level, hand, tempo_bpm, key_signature, octaves, exercise_type, is_active, created_at, updated_at)
    VALUES (
        '44444444-4444-4444-4444-444444444444',
        'Escala de Do Mayor - Mano Derecha',
        'Escala básica de Do mayor a una octava, mano derecha, tempo lento para principiantes.',
        'beginner',
        'right',
        60,
        'C major',
        1,
        'scale',
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Partitura esperada del ejercicio demo
    INSERT INTO expected_scores (id, exercise_id, version, score_data, created_at)
    VALUES (
        '55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        1,
        '{
            "notes": [
                {"position": 0, "note": "C", "octave": 4, "hand": "right", "finger": 1, "rhythm_position": 0.0},
                {"position": 1, "note": "D", "octave": 4, "hand": "right", "finger": 2, "rhythm_position": 1.0},
                {"position": 2, "note": "E", "octave": 4, "hand": "right", "finger": 3, "rhythm_position": 2.0},
                {"position": 3, "note": "F", "octave": 4, "hand": "right", "finger": 4, "rhythm_position": 3.0},
                {"position": 4, "note": "G", "octave": 4, "hand": "right", "finger": 5, "rhythm_position": 4.0}
            ]
        }'::jsonb,
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Umbrales de referencia demo, validados por el docente demo
    INSERT INTO reference_thresholds (id, exercise_id, version, thresholds, created_at)
    VALUES (
        '66666666-6666-6666-6666-666666666666',
        '44444444-4444-4444-4444-444444444444',
        1,
        '{
            "angle_tolerances": {"finger_curvature_deg": 15, "wrist_flatness_deg": 10},
            "distance_tolerances": {"finger_spacing_cm": 1.5},
            "timing_tolerance_ms": 150,
            "validated_by": ["22222222-2222-2222-2222-222222222222"]
        }'::jsonb,
        now()
    )
    ON CONFLICT (id) DO NOTHING;
END $$;
