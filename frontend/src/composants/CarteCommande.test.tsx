import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CarteCommande } from './CarteCommande';

const base = {
  id_commande: 'c1', id_client: 'cl1', nombre_mannes: 3,
  prioritaire: true, cintres_client: false, cintres_entr_rendus: false,
  date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie',
};

describe('CarteCommande', () => {
  test('affiche client, mannes et badge prioritaire', () => {
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} />);
    expect(screen.getByText(/Marie Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/3 manne/)).toBeInTheDocument();
    expect(screen.getByText('Prioritaire')).toBeInTheDocument();
  });

  test('carte « à faire » avec onModifier → bouton Modifier cliquable', async () => {
    const onModifier = vi.fn();
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} onModifier={onModifier} />);
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(onModifier).toHaveBeenCalled();
  });

  test('carte non « à faire » → pas de bouton Modifier', () => {
    render(<CarteCommande commande={{ ...base, statut: 'en_cours' }} onModifier={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  });
});
