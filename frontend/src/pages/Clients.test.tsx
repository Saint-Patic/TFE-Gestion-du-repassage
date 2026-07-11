import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/clients', () => ({
  listerClients: vi.fn(),
  modifierClient: vi.fn(),
  supprimerClient: vi.fn(),
}));

import { Clients } from './Clients';
import { listerClients, modifierClient, supprimerClient } from '../api/clients';

const liste = [
  { id_client: '1', nom: 'Dupont', prenom: 'Marie', telephone: '0470', email: null, code_barre: 'AB', date_creation: 'x' },
  { id_client: '2', nom: 'Martin', prenom: 'Jean', telephone: '0475', email: null, code_barre: 'CD', date_creation: 'x' },
];

function rendre() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Clients />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(listerClients).mockReset();
  vi.mocked(modifierClient).mockReset();
  vi.mocked(supprimerClient).mockReset();
});

describe('Clients', () => {
  test('affiche la liste et filtre par recherche', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    expect(await screen.findByText(/Dupont Marie/)).toBeInTheDocument();
    expect(screen.getByText(/Martin Jean/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Rechercher…'), 'dupont');
    expect(screen.queryByText(/Martin Jean/)).not.toBeInTheDocument();
  });

  test('clic ✎ ouvre la modale pré-remplie et enregistre', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(modifierClient).mockResolvedValue(liste[0]);
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Modifier le client'))[0]);
    expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(modifierClient).toHaveBeenCalledWith('1', expect.objectContaining({ nom: 'Dupont' }));
  });

  test('clic ✕ puis confirmation appelle supprimerClient', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(supprimerClient).mockResolvedValue({ anonymise: false });
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Supprimer le client'))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(supprimerClient).toHaveBeenCalledWith('1');
  });
});
