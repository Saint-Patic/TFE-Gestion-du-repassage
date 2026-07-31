import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/commandes', () => ({
  listerCommandes: vi.fn(),
  modifierCommande: vi.fn(),
  placerEmplacements: vi.fn(),
  demarrerRepassage: vi.fn(),
}));
vi.mock('../api/emplacements', () => ({
  listerEmplacements: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

let handlers: Record<string, () => void> = {};
const fauxSocket = {
  on: (evt: string, h: () => void) => { handlers[evt] = h; },
  off: () => {},
};
vi.mock('../temps-reel/socket', () => ({ obtenirSocket: () => fauxSocket }));

import { Tableau } from './Tableau';
import { listerCommandes, demarrerRepassage } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { useAuth } from '../auth/AuthContext';

const commandes = [
  { id_commande: 'c1', id_client: 'cl1', statut: 'a_faire' as const, nombre_mannes: 2, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie' },
  { id_commande: 'c2', id_client: 'cl2', statut: 'recupere' as const, nombre_mannes: 1, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, date_reception: 'x', client_nom: 'Martin', client_prenom: 'Jean' },
];

function connecte(role: string) {
  vi.mocked(useAuth).mockReturnValue({ utilisateur: { id_utilisateur: 'u', nom: 'X', role } } as never);
}

function rendre() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  render(<QueryClientProvider client={qc}><Tableau /></QueryClientProvider>);
  return { qc, spy };
}

beforeEach(() => {
  handlers = {};
  vi.mocked(listerCommandes).mockReset().mockResolvedValue(commandes);
  vi.mocked(listerEmplacements).mockReset().mockResolvedValue([]);
  vi.mocked(demarrerRepassage).mockReset().mockResolvedValue(commandes[0]);
  connecte('repasseuse');
});

describe('Tableau', () => {
  test('affiche les 4 colonnes', async () => {
    rendre();
    expect(await screen.findByText('À faire')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Fait')).toBeInTheDocument();
    expect(screen.getByText('Récupéré')).toBeInTheDocument();
  });

  test('un événement commandes:maj invalide la requête commandes', async () => {
    const { spy } = rendre();
    await screen.findByText('À faire');
    spy.mockClear();
    handlers['commandes:maj']();
    expect(spy).toHaveBeenCalledWith({ queryKey: ['commandes'] });
  });

  test('repasseuse : scanner un client appelle demarrerRepassage', async () => {
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(demarrerRepassage).toHaveBeenCalledWith('ABC123');
  });

  test('gérante : pas de champ de scan', async () => {
    connecte('gerante');
    rendre();
    await screen.findByText('À faire');
    expect(screen.queryByPlaceholderText('Scanner le client')).not.toBeInTheDocument();
  });
});
