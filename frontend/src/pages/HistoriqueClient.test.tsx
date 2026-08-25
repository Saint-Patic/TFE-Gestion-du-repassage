import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../api/clients', () => ({ historiqueClient: vi.fn() }));

import { HistoriqueClient } from './HistoriqueClient';
import { historiqueClient } from '../api/clients';

const donnees = {
  client: { id_client: 'cl1', nom: 'Dupont', prenom: 'Marie' },
  commandes: [
    {
      id_commande: 'c1', statut: 'recupere', nombre_mannes: 3, temps_repassage_s: 3661,
      date_reception: '2026-08-01T09:00:00Z', date_recuperation: '2026-08-03T15:00:00Z',
      evenements: [
        { ancien_statut: 'en_cours', nouveau_statut: 'fait', horodatage: '2026-08-02T11:00:00Z', utilisateur: 'Sophie' },
      ],
    },
  ],
};

function rendre() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/clients/cl1/historique']}>
        <Routes>
          <Route path="/clients/:id/historique" element={<HistoriqueClient />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(historiqueClient).mockReset();
});

describe('HistoriqueClient', () => {
  test('affiche le nom du client et ses commandes', async () => {
    vi.mocked(historiqueClient).mockResolvedValue(donnees as never);
    rendre();
    expect(await screen.findByText(/Marie Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/3 manne\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/01:01:01/)).toBeInTheDocument(); // 3661 s formatées
  });

  test('déplier une commande montre sa chronologie avec l’utilisatrice', async () => {
    vi.mocked(historiqueClient).mockResolvedValue(donnees as never);
    rendre();
    const ligne = await screen.findByRole('button', { name: /3 manne\(s\)/ });
    expect(screen.queryByText(/par Sophie/)).not.toBeInTheDocument();
    await userEvent.click(ligne);
    expect(screen.getByText(/en_cours → fait/)).toBeInTheDocument();
    expect(screen.getByText(/par Sophie/)).toBeInTheDocument();
  });

  test('client sans commande → message explicite', async () => {
    vi.mocked(historiqueClient).mockResolvedValue({ ...donnees, commandes: [] } as never);
    rendre();
    expect(await screen.findByText(/aucune commande/i)).toBeInTheDocument();
  });
});
