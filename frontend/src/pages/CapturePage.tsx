import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CameraOverlay from '../components/CameraOverlay';
import GatingIndicator from '../components/GatingIndicator';
import { PageHeader } from '../components/ui';
import { startCapture, startRecording, stopRecording, releaseCapture } from '../pipeline/capture';
import { getExercise } from '../api/catalog';
import { createSession } from '../api/sessions';
import { syncSessionResult, buildEmptySessionResult } from '../pipeline/sync';
import { useAuthStore } from '../store/authStore';
import { useExerciseStore } from '../store/exerciseStore';

type FlowStatus = 'idle' | 'ready' | 'recording' | 'analyzing' | 'done' | 'error';

export default function CapturePage() {
  const { id: exerciseId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { activeExercise, setActiveExercise } = useExerciseStore();
  const exercise = activeExercise?.id === exerciseId ? activeExercise : null;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<string>('');

  // Si se llega directo desde "Mis tareas", el ejercicio aún no está en el store.
  useEffect(() => {
    if (!exercise && exerciseId) {
      getExercise(exerciseId).then(setActiveExercise).catch(() => undefined);
    }
  }, [exercise, exerciseId, setActiveExercise]);

  useEffect(() => {
    startCapture()
      .then((s) => {
        setStream(s);
        setStatus('ready');
      })
      .catch(() => {
        setErrorMsg('No se pudo acceder a la cámara. Revisa los permisos del navegador e inténtalo de nuevo.');
        setStatus('error');
      });

    return () => {
      releaseCapture();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function handleStart() {
    if (!stream) return;
    startRecording(stream);
    startedAtRef.current = new Date().toISOString();
    setSeconds(0);
    setStatus('recording');
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  async function handleStop() {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('analyzing');
    try {
      await stopRecording();

      if (!exerciseId || !user) {
        throw new Error('Falta información de ejercicio o usuario');
      }

      const session = await createSession(user.id, exerciseId);

      const result = buildEmptySessionResult({
        sessionId: session.id,
        exerciseId,
        studentId: user.id,
        startedAt: startedAtRef.current,
        referenceThresholdVersion: exercise?.reference_thresholds?.[0]?.version ?? 1,
      });

      await syncSessionResult(result);

      setStatus('done');
      navigate('/historial');
    } catch {
      setErrorMsg('Ocurrió un error al guardar el intento. Inténtalo nuevamente.');
      setStatus('error');
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: `/catalogo/${exerciseId}`, label: 'Ejercicio' }}
        title={exercise?.title ?? 'Práctica'}
        subtitle="Coloca el teléfono de modo que se vean tus manos y el teclado."
      />

      <p className="small muted" style={{ marginBottom: '0.75rem' }}>
        En iPhone, usa esta página desde Safari (no desde la app instalada). El video no sale de tu dispositivo.
      </p>

      {errorMsg && (
        <div className="alert error" role="alert" style={{ marginBottom: '0.75rem' }}>
          {errorMsg}
        </div>
      )}

      <div className="capture-stage">
        <CameraOverlay stream={stream} />
      </div>
      <GatingIndicator lighting="unknown" framing="unknown" stability="unknown" />

      <div className="row" style={{ marginTop: '1.25rem' }}>
        {status === 'idle' && <p className="muted">Activando la cámara…</p>}
        {status === 'ready' && (
          <button className="btn btn-primary btn-block" onClick={handleStart}>
            Iniciar grabación
          </button>
        )}
        {status === 'recording' && (
          <button className="btn btn-primary btn-block" onClick={handleStop}>
            <span className="rec-dot" aria-hidden="true" /> Detener · {seconds} s
          </button>
        )}
        {status === 'analyzing' && <p className="muted">Guardando tu intento…</p>}
      </div>
    </>
  );
}
