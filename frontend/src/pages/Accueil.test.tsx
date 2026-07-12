import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Accueil } from './Accueil';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../auth/AuthContext';

function rendreAvecRole(role: string) {
  vi.mocked(useAuth).mockReturnValue({ utilisateur: { id_utilisateur: 'u', nom: 'X', role } } as never);
  return render(<MemoryRouter><Accueil /></MemoryRouter>);
}

describe('Accueil — liens clients selon le rôle', () => {
  test('gérante → voit les liens clients', () => {
    rendreAvecRole('gerante');
    expect(screen.getByText('Créer un profil client')).toBeInTheDocument();
    expect(screen.getByText('Gérer les clients')).toBeInTheDocument();
  });

  test('repasseuse → ne voit pas les liens clients', () => {
    rendreAvecRole('repasseuse');
    expect(screen.queryByText('Créer un profil client')).not.toBeInTheDocument();
    expect(screen.queryByText('Gérer les clients')).not.toBeInTheDocument();
  });
});
