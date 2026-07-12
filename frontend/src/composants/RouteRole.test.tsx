import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RouteRole } from './RouteRole';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../auth/AuthContext';

function rendreAvecRole(role: string) {
  vi.mocked(useAuth).mockReturnValue({ utilisateur: { id_utilisateur: 'u', nom: 'X', role } } as never);
  return render(
    <MemoryRouter initialEntries={['/clients']}>
      <Routes>
        <Route path="/" element={<p>Accueil</p>} />
        <Route
          path="/clients"
          element={<RouteRole roles={['gerante']}><p>Page clients</p></RouteRole>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RouteRole', () => {
  test('rôle autorisé → affiche la page', () => {
    rendreAvecRole('gerante');
    expect(screen.getByText('Page clients')).toBeInTheDocument();
  });

  test('rôle interdit → redirige vers l’accueil', () => {
    rendreAvecRole('repasseuse');
    expect(screen.queryByText('Page clients')).not.toBeInTheDocument();
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });
});
