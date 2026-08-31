import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CameraOverlay from '../components/CameraOverlay';
import GatingIndicator from '../components/GatingIndicator';
import { startCapture, startRecording, stopRecording, releaseCapture } from '../pipeline/capture';
import { createSession } from '../api/sessions';
import { syncSessionResult, buildEmptySessionResult } from '../pipeline/sync';
import { useAuthStore } from '../store/authStore';
import { useExerciseStore } from '../store/exerciseStore';

type FlowStatus = 'idle' | 'ready' | 'recording' | 'analyzing' | 'done' | 'error';

export default function CapturePage() {
  const { id: exerciseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const activeExercise = useExerciseStore((state) => state.activeExercise);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<string>('');

  useEffect(() => {
    startCapture()
      .then((s) => {
        setStream(s);
        setStatus('ready');
      })
      .catch(() => {
        setErrorMsg('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
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
        referenceThresholdVersion: activeExercise?.referenceThresholds?.[0]?.version ?? 1,
      });

      await syncSessionResult(result);

      setStatus('done');
      navigate('/history');
    } catch {
      setErrorMsg('Ocurrió un error al analizar la sesión. Intenta nuevamente.');
      setStatus('error');
    }
  }

  return (
    <div>
      <h2>Práctica: {activeExercise?.title ?? 'Ejercicio'}</h2>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        En iPhone, usa esta página desde Safari (no desde la app instalada).
      </p>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      <CameraOverlay stream={stream} />
      <GatingIndicator lighting="unknown" framing="unknown" stability="unknown" />

      <div style={{ marginTop: '1rem' }}>
        {status === 'ready' && <button onClick={handleStart}>Iniciar grabación</button>}
        {status === 'recording' && (
          <button onClick={handleStop}>Detener ({seconds}s)</button>
        )}
        {status === 'analyzing' && <p>Analizando…</p>}
      </div>
    </div>
  );
}
