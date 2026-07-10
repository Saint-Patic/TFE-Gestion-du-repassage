import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/clients', () => ({ creerClient: vi.fn() }));
vi.mock('../api/agent', () => ({ imprimerEtiquette: vi.fn() }));

import { NouveauClient } from './NouveauClient';
import { creerClient } from '../api/clients';
import { imprimerEtiquette } from '../api/agent';

const clientCree = {
  id_client: 'abc', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
  email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
};

beforeEach(() => {
  vi.mocked(creerClient).mockReset();
  vi.mocked(imprimerEtiquette).mockReset();
});

describe('NouveauClient', () => {
  test('soumission → affiche le code-barres et le bouton imprimer', async () => {
    vi.mocked(creerClient).mockResolvedValue(clientCree);
    render(<NouveauClient />);

    await userEvent.type(screen.getByPlaceholderText('Nom'), 'Dupont');
    await userEvent.type(screen.getByPlaceholderText('Prénom'), 'Marie');
    await userEvent.type(screen.getByPlaceholderText('Téléphone'), '0470');
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByText('K7QF2M9X')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeInTheDocument();
  });

  test('clic sur Imprimer → appelle imprimerEtiquette', async () => {
    vi.mocked(creerClient).mockResolvedValue(clientCree);
    vi.mocked(imprimerEtiquette).mockResolvedValue();
    render(<NouveauClient />);

    await userEvent.type(screen.getByPlaceholderText('Nom'), 'Dupont');
    await userEvent.type(screen.getByPlaceholderText('Prénom'), 'Marie');
    await userEvent.type(screen.getByPlaceholderText('Téléphone'), '0470');
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    await userEvent.click(await screen.findByRole('button', { name: /Imprimer/ }));

    expect(imprimerEtiquette).toHaveBeenCalledWith(clientCree);
  });
});
