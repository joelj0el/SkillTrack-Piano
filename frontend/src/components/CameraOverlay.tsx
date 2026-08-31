import { useEffect, useRef } from 'react';
import { startOverlay, stopOverlay } from '../pipeline/vision';

interface CameraOverlayProps {
  stream: MediaStream | null;
}

export default function CameraOverlay({ stream }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => undefined);

    let cancelled = false;
    video.onloadedmetadata = () => {
      if (!cancelled) {
        startOverlay(video, canvas);
      }
    };

    return () => {
      cancelled = true;
      stopOverlay();
    };
  }, [stream]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 640 }}>
      <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 8 }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
}
