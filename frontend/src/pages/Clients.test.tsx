import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/clients', () => ({
  listerClients: vi.fn(),
  modifierClient: vi.fn(),
  supprimerClient: vi.fn(),
}));

vi.mock('../api/agent', () => ({
  imprimerEtiquette: vi.fn(),
}));

import { Clients } from './Clients';
import { listerClients, modifierClient, supprimerClient } from '../api/clients';
import { imprimerEtiquette } from '../api/agent';

const liste = [
  { id_client: '1', nom: 'Dupont', prenom: 'Marie', telephone: '0470', email: null, code_barre: 'AB', date_creation: 'x' },
  { id_client: '2', nom: 'Martin', prenom: 'Jean', telephone: '0475', email: null, code_barre: 'CD', date_creation: 'x' },
];

function rendre() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Clients />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(listerClients).mockReset();
  vi.mocked(modifierClient).mockReset();
  vi.mocked(supprimerClient).mockReset();
  vi.mocked(imprimerEtiquette).mockReset();
  vi.mocked(imprimerEtiquette).mockResolvedValue(undefined);
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

  // Une étiquette collée s'abîme ou se perd, et le code-barres appartient au CLIENT :
  // sans réimpression, la cliente devenait définitivement non scannable (#340).
  test('clic 🖨 réimprime l’étiquette du client de la ligne', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Réimprimer l’étiquette'))[0]);
    expect(imprimerEtiquette).toHaveBeenCalledWith(liste[0]);
    expect(await screen.findByText(/étiquette envoyée/i)).toBeInTheDocument();
  });

  test('si l’agent d’impression ne répond pas, le message le dit', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(imprimerEtiquette).mockRejectedValue(new Error('injoignable'));
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Réimprimer l’étiquette'))[0]);
    expect(await screen.findByText(/agent d’impression/i)).toBeInTheDocument();
  });

  test('chaque ligne porte un lien vers l’historique du client (US #290)', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    await screen.findByText(/Dupont Marie/);
    const liens = screen.getAllByLabelText('Historique du client');
    expect(liens).toHaveLength(2);
    expect(liens[0]).toHaveAttribute('href', '/clients/1/historique');
  });
});
