import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/commandes', () => ({
  modifierCommande: vi.fn(),
  placerEmplacements: vi.fn(),
}));

import { ModaleModifierCommande } from './ModaleModifierCommande';
import { modifierCommande, placerEmplacements } from '../api/commandes';

const commande = {
  id_commande: 'c1', id_client: 'cl1', statut: 'a_faire' as const, nombre_mannes: 2,
  prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
  date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie',
};
const emplacements = [
  { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche' },
];

beforeEach(() => {
  vi.mocked(modifierCommande).mockReset();
  vi.mocked(placerEmplacements).mockReset();
});

describe('ModaleModifierCommande', () => {
  test('flags modifiés, mannes inchangé → PUT puis fermeture (pas de placement)', async () => {
    vi.mocked(modifierCommande).mockResolvedValue({ ...commande });
    const onFerme = vi.fn();
    const onEnregistre = vi.fn();
    render(
      <ModaleModifierCommande commande={commande} emplacements={emplacements}
        onFerme={onFerme} onEnregistre={onEnregistre} />
    );
    await userEvent.click(screen.getByLabelText('Prioritaire'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(modifierCommande).toHaveBeenCalledWith('c1', {
      nombre_mannes: 2, prioritaire: true, cintres_client: false, cintres_entr_rendus: false,
    });
    expect(onEnregistre).toHaveBeenCalled();
    expect(onFerme).toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Code emplacement')).not.toBeInTheDocument();
  });

  test('mannes changé → PUT puis phase placement puis POST emplacements', async () => {
    vi.mocked(modifierCommande).mockResolvedValue({ ...commande, nombre_mannes: 1 });
    vi.mocked(placerEmplacements).mockResolvedValue(undefined);
    const onFerme = vi.fn();
    const onEnregistre = vi.fn();
    render(
      <ModaleModifierCommande commande={commande} emplacements={emplacements}
        onFerme={onFerme} onEnregistre={onEnregistre} />
    );
    const champMannes = screen.getByLabelText('Nombre de mannes');
    await userEvent.clear(champMannes);
    await userEvent.type(champMannes, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const champ = await screen.findByPlaceholderText('Code emplacement');
    expect(modifierCommande).toHaveBeenCalledWith('c1', {
      nombre_mannes: 1, prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
    });
    await userEvent.type(champ, 'A1G{enter}');
    await userEvent.click(screen.getByRole('button', { name: /Terminer/ }));
    expect(placerEmplacements).toHaveBeenCalledWith('c1', [{ id_emplacement: 'e1', nombre_mannes: 1 }]);
    expect(onEnregistre).toHaveBeenCalled();
    expect(onFerme).toHaveBeenCalled();
  });
});
