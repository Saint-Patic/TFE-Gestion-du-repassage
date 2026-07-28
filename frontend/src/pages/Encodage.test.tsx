import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/commandes', () => ({
  rechercherClientParCodeBarre: vi.fn(),
  creerCommande: vi.fn(),
}));

import { Encodage } from './Encodage';
import { rechercherClientParCodeBarre, creerCommande } from '../api/commandes';
import { ErreurApi } from '../api/client';

const client = {
  id_client: 'abc', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
  email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
};

beforeEach(() => {
  vi.mocked(rechercherClientParCodeBarre).mockReset();
  vi.mocked(creerCommande).mockReset();
});

describe('Encodage', () => {
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
