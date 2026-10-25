// Modo demo (`npm run demo`): responde las llamadas de la API con datos en memoria,
// para mostrar el prototipo sin backend ni base de datos. Los cambios se pierden al recargar.
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const INST = '11111111-1111-1111-1111-111111111111';
const TEACHER = '22222222-2222-2222-2222-222222222222';
const STUDENT = '33333333-3333-3333-3333-333333333333';
const ADMIN = '77777777-7777-7777-7777-777777777777';

const now = () => new Date().toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
// Sin crypto.randomUUID: no existe en HTTP no seguro (p. ej. abrir la demo desde el celular por IP local).
const uid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

const user = (id: string, email: string, full_name: string, role: string) => ({
  id, email, full_name, role, institution_id: INST, is_active: true, created_at: now(),
});

const db = {
  institutions: [{ id: INST, name: 'Conservatorio Demo Cochabamba', city: 'Cochabamba', created_at: now() }],
  users: [
    user(TEACHER, 'demo@docente.com', 'Docente Demo', 'teacher'),
    user(STUDENT, 'demo@estudiante.com', 'Estudiante Demo', 'student'),
    user('33333333-0000-0000-0000-000000000002', 'ana@estudiante.com', 'Ana Rojas', 'student'),
    user('33333333-0000-0000-0000-000000000003', 'luis@estudiante.com', 'Luis Mamani', 'student'),
    user(ADMIN, 'demo@admin.com', 'Administrador Demo', 'admin'),
  ],
  links: [
    [TEACHER, STUDENT],
    [TEACHER, '33333333-0000-0000-0000-000000000002'],
  ] as [string, string][],
  exercises: [
    exercise('44444444-4444-4444-4444-444444444444', 'Escala de Do Mayor - Mano Derecha', 'scale', 'right', 60,
      'C major', 'Escala básica de Do mayor a una octava, mano derecha, tempo lento.',
      [['C', 1], ['D', 2], ['E', 3], ['F', 1], ['G', 2], ['A', 3], ['B', 4], ['C', 5]], 'right'),
    exercise('44444444-0000-0000-0000-000000000002', 'Escala de Do Mayor - Mano Izquierda', 'scale', 'left', 60,
      'C major', 'La misma escala con la mano izquierda, cuidando el cruce del dedo 3.',
      [['C', 5], ['D', 4], ['E', 3], ['F', 2], ['G', 1], ['A', 3], ['B', 2], ['C', 1]], 'left'),
    exercise('44444444-0000-0000-0000-000000000003', 'Arpegio de Do Mayor', 'arpeggio', 'right', 72,
      'C major', 'Arpegio de tónica en una octava, mano derecha.',
      [['C', 1], ['E', 2], ['G', 3], ['C', 5]], 'right'),
    exercise('44444444-0000-0000-0000-000000000004', 'Cinco dedos en Sol - Manos juntas', 'exercise', 'both', 66,
      'G major', 'Posición fija de cinco dedos, manos juntas en movimiento paralelo.',
      [['G', 1], ['A', 2], ['B', 3], ['C', 4], ['D', 5]], 'both'),
  ],
  tasks: [] as Record<string, unknown>[],
  observations: [] as Record<string, unknown>[],
  sessions: [] as Record<string, unknown>[],
};

db.tasks.push(
  task(STUDENT, '44444444-4444-4444-4444-444444444444', daysFromNow(2), 60, 'Manos relajadas; el pulgar pasa por debajo sin girar la muñeca.', 'pending'),
  task(STUDENT, '44444444-0000-0000-0000-000000000003', daysFromNow(6), 60, null, 'in_progress'),
  task(STUDENT, '44444444-0000-0000-0000-000000000002', daysFromNow(-3), 50, 'Muy bien la semana pasada.', 'completed'),
  task('33333333-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000004', daysFromNow(-1), 66, null, 'pending'),
);
db.observations.push(
  { id: uid(), teacher_id: TEACHER, student_id: STUDENT, session_id: null, created_at: new Date(Date.now() - 86_400_000).toISOString(),
    content: 'Buen avance con la escala. Cuida que el dedo 4 no se aplane al tocar Fa.' },
  { id: uid(), teacher_id: TEACHER, student_id: STUDENT, session_id: null, created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    content: 'Practica con metrónomo a 50 antes de subir a 60.\nPrimero manos separadas.' },
);
db.sessions.push({
  id: uid(), student_id: STUDENT, exercise_id: '44444444-4444-4444-4444-444444444444',
  started_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  ended_at: new Date(Date.now() - 2 * 86_400_000 + 95_000).toISOString(),
  status: 'completed', reference_threshold_version: 1, created_at: now(),
});

function exercise(id: string, title: string, exercise_type: string, hand: string, tempo_bpm: number,
  key_signature: string, description: string, seq: [string, number][], noteHand: string) {
  // Secuencia ascendente: sube de octava cada vez que la nota "da la vuelta" (B → C).
  const order = 'CDEFGAB';
  let octave = 4;
  const notes = seq.flatMap(([note, finger], i) => {
    if (i > 0 && order.indexOf(note) <= order.indexOf(seq[i - 1][0])) octave++;
    const base = { position: i, note, octave, finger, rhythm_position: i };
    return noteHand === 'both'
      ? [{ ...base, hand: 'right' }, { ...base, octave: 3, hand: 'left', finger: 6 - finger }]
      : [{ ...base, hand: noteHand }];
  });
  return {
    id, title, description, difficulty_level: 'beginner', hand, tempo_bpm, key_signature, octaves: 1,
    exercise_type, is_active: true, created_at: now(), updated_at: now(),
    expected_score: { id: uid(), version: 1, score_data: { notes }, created_at: now() },
    reference_thresholds: [],
  };
}

function task(student_id: string, exercise_id: string, due_date: string, tempo_bpm: number, notes: string | null, status: string) {
  return { id: uid(), teacher_id: TEACHER, student_id, exercise_id, due_date, tempo_bpm, notes, status, created_at: now(), updated_at: now() };
}

function currentUserId(config: InternalAxiosRequestConfig): string | null {
  const auth = String(config.headers?.Authorization ?? '');
  return auth.startsWith('Bearer demo-') ? auth.slice('Bearer demo-'.length) : null;
}

class HttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

function route(method: string, path: string, params: Record<string, string>, body: any, me: string | null): unknown {
  const students = (t: string) => db.links.filter(([tt]) => tt === t).map(([, s]) => db.users.find((u) => u.id === s)!);
  let m: RegExpMatchArray | null;

  if (method === 'post' && path === '/auth/token') {
    const form = new URLSearchParams(body);
    const u = db.users.find((x) => x.email === form.get('username'));
    if (!u || form.get('password') !== 'demo1234') throw new HttpError(401, 'Credenciales incorrectas');
    return { access_token: `demo-${u.id}`, token_type: 'bearer' };
  }
  if (!me) throw new HttpError(401, 'No autenticado');

  if (method === 'get' && path === '/auth/me') return db.users.find((u) => u.id === me);
  if (method === 'get' && path === '/exercises') return db.exercises;
  if (method === 'get' && (m = path.match(/^\/exercises\/([^/]+)$/))) {
    const ex = db.exercises.find((e) => e.id === m![1]);
    if (!ex) throw new HttpError(404, 'Ejercicio no encontrado');
    return ex;
  }

  if (method === 'get' && path === '/tasks')
    return db.tasks.filter((t) => (!params.student_id || t.student_id === params.student_id) && (!params.teacher_id || t.teacher_id === params.teacher_id));
  if (method === 'post' && path === '/tasks') {
    const t = { id: uid(), status: 'pending', created_at: now(), updated_at: now(), ...body };
    db.tasks.unshift(t);
    return t;
  }
  if (method === 'put' && (m = path.match(/^\/tasks\/([^/]+)$/))) {
    const t = db.tasks.find((x) => x.id === m![1]);
    if (!t) throw new HttpError(404, 'Tarea no encontrada');
    Object.assign(t, body, { updated_at: now() });
    return t;
  }

  if (method === 'post' && path === '/observations') {
    const o = { id: uid(), session_id: null, created_at: now(), ...body };
    db.observations.unshift(o);
    return o;
  }
  if (method === 'get' && (m = path.match(/^\/observations\/student\/([^/]+)$/)))
    return db.observations.filter((o) => o.student_id === m![1]);

  if (method === 'get' && (m = path.match(/^\/sessions\/student\/([^/]+)$/)))
    return db.sessions.filter((s) => s.student_id === m![1]);
  if (method === 'post' && path === '/sessions') {
    const s = { id: uid(), started_at: now(), ended_at: null, status: 'recording', reference_threshold_version: null, created_at: now(), ...body };
    db.sessions.unshift(s);
    return s;
  }
  if (method === 'post' && (m = path.match(/^\/sessions\/([^/]+)\/result$/))) {
    const s = db.sessions.find((x) => x.id === m![1]);
    if (s) Object.assign(s, { ended_at: now(), status: 'completed' });
    return { id: uid(), session_id: m[1], raw_result: body, created_at: now() };
  }

  if (method === 'get' && path === '/users/me/students') return students(me);
  if (method === 'get' && path === '/users/me/teachers')
    return db.links.filter(([, s]) => s === me).map(([t]) => db.users.find((u) => u.id === t));
  if (method === 'get' && path === '/users') return db.users.filter((u) => !params.role || u.role === params.role);
  if (method === 'post' && path === '/users') {
    if (db.users.some((u) => u.email === body.email)) throw new HttpError(400, 'El email ya está registrado');
    const u = { id: uid(), is_active: true, created_at: now(), ...body };
    delete u.password;
    db.users.push(u);
    return u;
  }
  if ((m = path.match(/^\/users\/([^/]+)\/students\/([^/]+)$/))) {
    db.links = db.links.filter(([t, s]) => !(t === m![1] && s === m![2]));
    if (method === 'post') db.links.push([m[1], m[2]]);
    return null;
  }
  if (method === 'get' && (m = path.match(/^\/users\/([^/]+)\/students$/))) return students(m[1]);
  if (method === 'get' && (m = path.match(/^\/users\/([^/]+)$/))) {
    const u = db.users.find((x) => x.id === m![1]);
    if (!u) throw new HttpError(404, 'Usuario no encontrado');
    return u;
  }

  if (method === 'get' && path === '/institutions') return db.institutions;
  if (method === 'post' && path === '/institutions') {
    const i = { id: uid(), created_at: now(), city: null, ...body };
    db.institutions.push(i);
    return i;
  }

  throw new HttpError(404, `Ruta simulada no disponible: ${method.toUpperCase()} ${path}`);
}

export const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((r) => setTimeout(r, 250)); // latencia simulada para ver los estados de carga
  const method = (config.method ?? 'get').toLowerCase();
  const path = (config.url ?? '').split('?')[0];
  const params = Object.fromEntries(
    Object.entries(config.params ?? {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
  );
  // axios ya serializó el cuerpo: JSON en general, formulario urlencoded en el login.
  const raw = config.data instanceof URLSearchParams ? config.data.toString() : config.data;
  const body = path === '/auth/token' || typeof raw !== 'string' ? raw : JSON.parse(raw || '{}');

  const respond = (status: number, data: unknown): AxiosResponse =>
    ({ data: structuredClone(data ?? null), status, statusText: String(status), headers: {}, config });

  try {
    const data = route(method, path, params, body, currentUserId(config));
    return respond(method === 'post' ? 201 : 200, data);
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
    const response = respond(err.status, { detail: err.detail });
    throw new AxiosError(err.detail, String(err.status), config, null, response);
  }
};
