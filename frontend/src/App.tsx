import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout, { homePathFor } from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import { useAuthStore } from './store/authStore';
import { ADMIN_ROLES } from './types';
import type { RoleName } from './types';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import ExercisePage from './pages/ExercisePage';
import CapturePage from './pages/CapturePage';
import HistoryPage from './pages/HistoryPage';
import NotFoundPage from './pages/NotFoundPage';
import MyTasksPage from './pages/student/MyTasksPage';
import MyObservationsPage from './pages/student/MyObservationsPage';
import StudentsPage from './pages/teacher/StudentsPage';
import StudentDetailPage from './pages/teacher/StudentDetailPage';
import AssignTaskPage from './pages/teacher/AssignTaskPage';
import AdminPage from './pages/admin/AdminPage';

function HomeRedirect() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(user.role)} replace />;
}

function guard(element: ReactElement, roles?: RoleName[]) {
  return <PrivateRoute roles={roles}>{element}</PrivateRoute>;
}

const STUDENT: RoleName[] = ['student'];
const TEACHER: RoleName[] = ['teacher'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<Layout />}>
          {/* Estudiante */}
          <Route path="/tareas" element={guard(<MyTasksPage />, STUDENT)} />
          <Route path="/observaciones" element={guard(<MyObservationsPage />, STUDENT)} />
          <Route path="/historial" element={guard(<HistoryPage />, STUDENT)} />
          <Route path="/catalogo/:id/practicar" element={guard(<CapturePage />, STUDENT)} />

          {/* Compartidas */}
          <Route path="/catalogo" element={guard(<CatalogPage />)} />
          <Route path="/catalogo/:id" element={guard(<ExercisePage />)} />

          {/* Docente */}
          <Route path="/docente" element={guard(<StudentsPage />, TEACHER)} />
          <Route path="/docente/asignar" element={guard(<AssignTaskPage />, TEACHER)} />
          <Route path="/docente/estudiantes/:id" element={guard(<StudentDetailPage />, TEACHER)} />

          {/* Administración */}
          <Route path="/admin" element={guard(<AdminPage />, ADMIN_ROLES)} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
