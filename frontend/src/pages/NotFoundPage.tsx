import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Esta página no existe"
      action={
        <Link to="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      }
    >
      Puede que el enlace esté incompleto o que la página se haya movido.
    </EmptyState>
  );
}
