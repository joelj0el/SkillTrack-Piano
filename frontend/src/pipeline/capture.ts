// Captura de video/audio desde la cámara del dispositivo, y grabación local.

let activeStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];

export async function startCapture(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: true,
  });
  activeStream = stream;
  return stream;
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  // Safari/iOS a menudo no soporta MediaRecorder.isTypeSupported de forma fiable
  return 'video/mp4';
}

export function startRecording(stream: MediaStream): void {
  recordedChunks = [];
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(stream, { mimeType });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };
  mediaRecorder.start();
}

export function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('No hay una grabación activa'));
      return;
    }
    const recorder = mediaRecorder;
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'video/webm';
      resolve(new Blob(recordedChunks, { type: mimeType }));
    };
    recorder.stop();
  });
}

export function releaseCapture(): void {
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
  mediaRecorder = null;
  recordedChunks = [];
}
