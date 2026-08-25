import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModaleChoixCommande } from './ModaleChoixCommande';

const base = {
  id_client: 'cl1', cintres_client: false, cintres_entr_rendus: false,
  client_nom: 'Dupont', client_prenom: 'Marie',
};

const commandes = [
  { ...base, id_commande: 'c1', statut: 'fait' as const, action: 'recuperer' as const,
    nombre_mannes: 1, prioritaire: false, date_reception: '2026-08-21T09:00:00Z' },
  { ...base, id_commande: 'c2', statut: 'a_faire' as const, action: 'demarrer' as const,
    nombre_mannes: 2, prioritaire: true, date_reception: '2026-08-24T09:00:00Z' },
];

describe('ModaleChoixCommande', () => {
  test('titre nommant le client et le nombre de commandes', () => {
    render(<ModaleChoixCommande commandes={commandes} onChoisir={vi.fn()} onAnnuler={vi.fn()} />);
    expect(screen.getByText('2 commandes pour Marie Dupont')).toBeInTheDocument();
  });

  test('chaque ligne porte son verbe, ses mannes et sa date', () => {
    render(<ModaleChoixCommande commandes={commandes} onChoisir={vi.fn()} onAnnuler={vi.fn()} />);
    expect(screen.getByText('Remettre')).toBeInTheDocument();
    expect(screen.getByText('Démarrer')).toBeInTheDocument();
    expect(screen.getByText(/1 manne · reçue le 21\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/2 mannes · reçue le 24\/08\/2026/)).toBeInTheDocument();
  });

  test('badge prioritaire sur la seule commande concernée', () => {
    render(<ModaleChoixCommande commandes={commandes} onChoisir={vi.fn()} onAnnuler={vi.fn()} />);
    expect(screen.getAllByText('Prioritaire')).toHaveLength(1);
  });

  test('cliquer une ligne remonte LA commande de cette ligne', async () => {
    const onChoisir = vi.fn();
    render(<ModaleChoixCommande commandes={commandes} onChoisir={onChoisir} onAnnuler={vi.fn()} />);
    await userEvent.click(screen.getByText('Démarrer'));
    expect(onChoisir).toHaveBeenCalledWith(commandes[1]);
  });

  test('Annuler ne choisit rien', async () => {
    const onChoisir = vi.fn();
    const onAnnuler = vi.fn();
    render(<ModaleChoixCommande commandes={commandes} onChoisir={onChoisir} onAnnuler={onAnnuler} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onAnnuler).toHaveBeenCalled();
    expect(onChoisir).not.toHaveBeenCalled();
  });
});
