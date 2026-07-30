import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/emplacements', () => ({
  listerEmplacements: vi.fn(),
  contenuEmplacement: vi.fn(),
  deplacerEmplacement: vi.fn(),
}));

import { Reorganisation } from './Reorganisation';
import { listerEmplacements, contenuEmplacement, deplacerEmplacement } from '../api/emplacements';

const A1G = { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche', est_au_sol: false, id_client_occupant: 'cl1' };
const C2D = { id_emplacement: 'e2', code_barre: 'C2D', etagere: 'C', niveau: 2, position: 'droite', est_au_sol: false, id_client_occupant: null };
const D1G = { id_emplacement: 'e3', code_barre: 'D1G', etagere: 'D', niveau: 1, position: 'gauche', est_au_sol: false, id_client_occupant: 'AUTRE' };
const SOL = { id_emplacement: 'sol', code_barre: 'SOL', etagere: null, niveau: null, position: null, est_au_sol: true, id_client_occupant: null };

beforeEach(() => {
  vi.mocked(listerEmplacements).mockReset().mockResolvedValue([A1G, C2D, D1G, SOL]);
  vi.mocked(contenuEmplacement).mockReset();
  vi.mocked(deplacerEmplacement).mockReset().mockResolvedValue(undefined);
});

describe('Reorganisation', () => {
  test('source étagère → destination : deplacerEmplacement avec le client déduit', async () => {
    vi.mocked(contenuEmplacement).mockResolvedValue([
      { id_commande: 'cmd1', nombre_mannes: 2, statut: 'a_faire', id_client: 'cl1', client_nom: 'Dupont', client_prenom: 'Marie' },
    ]);
    render(<Reorganisation />);
    await userEvent.type(await screen.findByLabelText(/source/i), 'A1G{enter}');
    await userEvent.type(await screen.findByLabelText(/destination/i), 'C2D{enter}');
    await userEvent.click(await screen.findByRole('button', { name: /Déplacer vers C2D/ }));
    expect(deplacerEmplacement).toHaveBeenCalledWith('e1', 'e2', 'cl1');
  });

  test('source au sol : choisir un client puis déplacer', async () => {
    vi.mocked(contenuEmplacement).mockResolvedValue([
      { id_commande: 'cmd1', nombre_mannes: 1, statut: 'a_faire', id_client: 'cl1', client_nom: 'Dupont', client_prenom: 'Marie' },
      { id_commande: 'cmd2', nombre_mannes: 2, statut: 'fait', id_client: 'cl2', client_nom: 'Martin', client_prenom: 'Jean' },
    ]);
    render(<Reorganisation />);
    await screen.findByLabelText(/source/i);
    await userEvent.click(screen.getByRole('button', { name: 'Depuis le sol' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Marie Dupont' }));
    await userEvent.type(await screen.findByLabelText(/destination/i), 'C2D{enter}');
    await userEvent.click(await screen.findByRole('button', { name: /Déplacer vers C2D/ }));
    expect(deplacerEmplacement).toHaveBeenCalledWith('sol', 'e2', 'cl1');
  });

  test('destination occupée par un autre client : pas de bouton Déplacer', async () => {
    vi.mocked(contenuEmplacement).mockResolvedValue([
      { id_commande: 'cmd1', nombre_mannes: 2, statut: 'a_faire', id_client: 'cl1', client_nom: 'Dupont', client_prenom: 'Marie' },
    ]);
    render(<Reorganisation />);
    await userEvent.type(await screen.findByLabelText(/source/i), 'A1G{enter}');
    await userEvent.type(await screen.findByLabelText(/destination/i), 'D1G{enter}');
    expect(await screen.findByText(/autre client/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Déplacer vers/ })).not.toBeInTheDocument();
    expect(deplacerEmplacement).not.toHaveBeenCalled();
  });

  test('source == destination : message, pas d’appel', async () => {
    vi.mocked(contenuEmplacement).mockResolvedValue([
      { id_commande: 'cmd1', nombre_mannes: 2, statut: 'a_faire', id_client: 'cl1', client_nom: 'Dupont', client_prenom: 'Marie' },
    ]);
    render(<Reorganisation />);
    await userEvent.type(await screen.findByLabelText(/source/i), 'A1G{enter}');
    await userEvent.type(await screen.findByLabelText(/destination/i), 'A1G{enter}');
    expect(await screen.findByText(/identiques/)).toBeInTheDocument();
    expect(deplacerEmplacement).not.toHaveBeenCalled();
  });
});
