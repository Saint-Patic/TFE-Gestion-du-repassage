import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/commandes', () => ({
  listerCommandes: vi.fn(),
  modifierCommande: vi.fn(),
  placerEmplacements: vi.fn(),
}));
vi.mock('../api/emplacements', () => ({
  listerEmplacements: vi.fn(),
}));

import { Tableau } from './Tableau';
import { listerCommandes } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';

const commandes = [
  { id_commande: 'c1', id_client: 'cl1', statut: 'a_faire' as const, nombre_mannes: 2, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie' },
  { id_commande: 'c2', id_client: 'cl2', statut: 'en_cours' as const, nombre_mannes: 1, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, date_reception: 'x', client_nom: 'Martin', client_prenom: 'Jean' },
];

function rendre() {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}><Tableau /></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(listerCommandes).mockReset();
  vi.mocked(listerEmplacements).mockReset();
  vi.mocked(listerEmplacements).mockResolvedValue([]);
});

describe('Tableau', () => {
  test('affiche les cartes des commandes actives', async () => {
    vi.mocked(listerCommandes).mockResolvedValue(commandes);
    rendre();
    expect(await screen.findByText(/Marie Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/Jean Martin/)).toBeInTheDocument();
  });

  test('clic Modifier sur une carte à faire ouvre la modale', async () => {
    vi.mocked(listerCommandes).mockResolvedValue(commandes);
    rendre();
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Modifier la commande')).toBeInTheDocument();
  });
});
