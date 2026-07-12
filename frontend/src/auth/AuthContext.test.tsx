import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';

// Le socket n'est pas pertinent ici — on l'isole.
vi.mock('../temps-reel/socket', () => ({
  connecterSocket: vi.fn(),
  deconnecterSocket: vi.fn(),
}));

function BoutonDeconnexion() {
  const { deconnexion } = useAuth();
  return <button onClick={deconnexion}>Déconnexion</button>;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('AuthContext — déconnexion', () => {
  test('vide le cache TanStack Query à la déconnexion (pas de fuite entre sessions)', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['clients'], [{ id_client: '1', nom: 'Dupont' }]);

    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <BoutonDeconnexion />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(qc.getQueryData(['clients'])).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(qc.getQueryData(['clients'])).toBeUndefined();
  });
});
