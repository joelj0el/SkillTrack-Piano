import { useState } from 'react';
import { PageHeader, Tabs } from '../../components/ui';
import InstitutionsPanel from './InstitutionsPanel';
import UsersPanel from './UsersPanel';
import LinksPanel from './LinksPanel';

type Tab = 'users' | 'links' | 'institutions';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <>
      <PageHeader title="Administración" subtitle="Instituciones, cuentas de docentes y estudiantes, y quién enseña a quién." />
      <Tabs
        tabs={[
          { key: 'users', label: 'Usuarios' },
          { key: 'links', label: 'Docentes y estudiantes' },
          { key: 'institutions', label: 'Instituciones' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'users' && <UsersPanel />}
      {tab === 'links' && <LinksPanel />}
      {tab === 'institutions' && <InstitutionsPanel />}
    </>
  );
}
