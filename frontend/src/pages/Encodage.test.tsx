import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/commandes', () => ({
  rechercherClientParCodeBarre: vi.fn(),
  creerCommande: vi.fn(),
  placerEmplacements: vi.fn(),
}));
vi.mock('../api/emplacements', () => ({
  listerEmplacements: vi.fn(),
}));

import { Encodage } from './Encodage';
import { rechercherClientParCodeBarre, creerCommande, placerEmplacements } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { ErreurApi } from '../api/client';

const client = {
  id_client: 'abc', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
  email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
};
const emplacements = [
  { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche' },
  { id_emplacement: 'e2', code_barre: 'B2C', etagere: 'B', niveau: 2, position: 'centre' },
];

// Amène l'écran en phase placement avec une commande de `mannes` mannes.
async function allerEnPlacement(mannes: number) {
  vi.mocked(rechercherClientParCodeBarre).mockResolvedValue(client);
  vi.mocked(creerCommande).mockResolvedValue({
    id_commande: 'cmd1', id_client: 'abc', statut: 'a_faire',
    nombre_mannes: mannes, prioritaire: false, date_reception: 'x',
  });
  render(<Encodage />);
  await userEvent.type(screen.getByPlaceholderText('Code-barres'), 'K7QF2M9X{enter}');
  const champMannes = await screen.findByLabelText('Nombre de mannes');
  await userEvent.clear(champMannes);
  await userEvent.type(champMannes, String(mannes));
  await userEvent.click(screen.getByRole('button', { name: /Valider la réception/ }));
}

beforeEach(() => {
  vi.mocked(rechercherClientParCodeBarre).mockReset();
  vi.mocked(creerCommande).mockReset();
  vi.mocked(placerEmplacements).mockReset();
  vi.mocked(listerEmplacements).mockReset();
  vi.mocked(listerEmplacements).mockResolvedValue(emplacements);
});

describe('Encodage — réception (US #150)', () => {
  test('scan d’un code connu → affiche le client', async () => {
    vi.mocked(rechercherClientParCodeBarre).mockResolvedValue(client);
    render(<Encodage />);
    await userEvent.type(screen.getByPlaceholderText('Code-barres'), 'K7QF2M9X{enter}');
    expect(await screen.findByText('Marie Dupont')).toBeInTheDocument();
  });

  test('validation → crée la commande avec le bon client + mannes', async () => {
    vi.mocked(rechercherClientParCodeBarre).mockResolvedValue(client);
    vi.mocked(creerCommande).mockResolvedValue({
      id_commande: 'cmd1', id_client: 'abc', statut: 'a_faire',
      nombre_mannes: 2, prioritaire: false, date_reception: 'x',
    });
    render(<Encodage />);
    await userEvent.type(screen.getByPlaceholderText('Code-barres'), 'K7QF2M9X{enter}');
    const champMannes = await screen.findByLabelText('Nombre de mannes');
    await userEvent.clear(champMannes);
    await userEvent.type(champMannes, '2');
    await userEvent.click(screen.getByRole('button', { name: /Valider la réception/ }));
    expect(creerCommande).toHaveBeenCalledWith({ id_client: 'abc', nombre_mannes: 2 });
  });

  test('code inconnu (404) → message d’erreur', async () => {
    vi.mocked(rechercherClientParCodeBarre).mockRejectedValue(
      new ErreurApi(404, { message: 'Client inconnu.' })
    );
    render(<Encodage />);
    await userEvent.type(screen.getByPlaceholderText('Code-barres'), 'ZZZ{enter}');
    expect(await screen.findByText(/Client inconnu/)).toBeInTheDocument();
  });
});

describe('Encodage — placement (US #160)', () => {
  test('scanner N emplacements décrémente le reste puis active Terminer', async () => {
    await allerEnPlacement(2);
    expect(await screen.findByText(/reste 2/)).toBeInTheDocument();
    const champ = screen.getByPlaceholderText('Code emplacement');
    await userEvent.type(champ, 'A1G{enter}');
    expect(await screen.findByText(/reste 1/)).toBeInTheDocument();
    await userEvent.type(champ, 'A1G{enter}');
    expect(await screen.findByText(/reste 0/)).toBeInTheDocument();
    const terminer = screen.getByRole('button', { name: /Terminer/ });
    expect(terminer).toBeEnabled();
    await userEvent.click(terminer);
    expect(placerEmplacements).toHaveBeenCalledWith('cmd1', [{ id_emplacement: 'e1', nombre_mannes: 2 }]);
  });

  test('emplacement inconnu → message, reste inchangé', async () => {
    await allerEnPlacement(1);
    const champ = await screen.findByPlaceholderText('Code emplacement');
    await userEvent.type(champ, 'ZZZ{enter}');
    expect(await screen.findByText(/Emplacement inconnu/)).toBeInTheDocument();
    expect(screen.getByText(/reste 1/)).toBeInTheDocument();
  });

  test('annuler le dernier scan réincrémente le reste', async () => {
    await allerEnPlacement(2);
    const champ = await screen.findByPlaceholderText('Code emplacement');
    await userEvent.type(champ, 'A1G{enter}');
    expect(await screen.findByText(/reste 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Annuler le dernier scan/ }));
    expect(await screen.findByText(/reste 2/)).toBeInTheDocument();
  });
});
