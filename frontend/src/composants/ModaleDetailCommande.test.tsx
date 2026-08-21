import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModaleDetailCommande } from './ModaleDetailCommande';

const base = {
  id_commande: 'c1', id_client: 'cl1', nombre_mannes: 3,
  prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
  date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie',
};

describe('ModaleDetailCommande', () => {
  test('affiche cliente, statut, mannes et repasseuse', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const, repasseuse_nom: 'Lucie' }}
      onFermer={vi.fn()} />);
    expect(screen.getByText('Marie Dupont')).toBeInTheDocument();
    expect(screen.getByText('À faire')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Lucie')).toBeInTheDocument();
  });

  test('sans repasseuse → « Non attribuée »', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const, repasseuse_nom: null }}
      onFermer={vi.fn()} />);
    expect(screen.getByText('Non attribuée')).toBeInTheDocument();
  });

  test('emplacements formatés « CODE (n) », séparés par des virgules', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const, emplacements: [
        { code_barre: 'A1G', nombre_mannes: 1 },
        { code_barre: 'B2C', nombre_mannes: 2 },
      ] }}
      onFermer={vi.fn()} />);
    expect(screen.getByText('A1G (1), B2C (2)')).toBeInTheDocument();
  });

  test('débordement au sol → affiché « SOL (n) »', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const,
        emplacements: [{ code_barre: 'SOL', nombre_mannes: 3 }] }}
      onFermer={vi.fn()} />);
    expect(screen.getByText('SOL (3)')).toBeInTheDocument();
  });

  test('aucun emplacement → tiret', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'en_cours' as const, emplacements: [] }}
      onFermer={vi.fn()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('champ emplacements absent → tiret, sans planter', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const }} onFermer={vi.fn()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('« en cours » en marche → bouton Pause, pas Reprendre', async () => {
    const onPause = vi.fn();
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'en_cours' as const,
        repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }}
      onFermer={vi.fn()} onPause={onPause} onReprendre={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledWith(expect.objectContaining({ id_commande: 'c1' }));
  });

  test('« en cours » en pause → bouton Reprendre, pas Pause', async () => {
    const onReprendre = vi.fn();
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'en_cours' as const, repassage_debut: null, temps_repassage_s: 42 }}
      onFermer={vi.fn()} onPause={vi.fn()} onReprendre={onReprendre} />);
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(onReprendre).toHaveBeenCalled();
  });

  test('gérante (sans onPause/onReprendre) → aucune commande de chrono', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'en_cours' as const,
        repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }}
      onFermer={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument();
  });

  test('« fait » → chrono figé sur le temps total', () => {
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'fait' as const, repassage_debut: null, temps_repassage_s: 3661 }}
      onFermer={vi.fn()} />);
    expect(screen.getByText('01:01:01')).toBeInTheDocument();
  });

  test('commande prioritaire → surlignage rouge conservé', () => {
    const { container } = render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const, prioritaire: true }} onFermer={vi.fn()} />);
    expect(container.querySelector('.border-red-500')).toBeTruthy();
    expect(screen.getByText('Prioritaire')).toBeInTheDocument();
  });

  test('non prioritaire → pas de surlignage', () => {
    const { container } = render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const }} onFermer={vi.fn()} />);
    expect(container.querySelector('.border-red-500')).toBeFalsy();
  });

  test('le bouton Fermer appelle onFermer', async () => {
    const onFermer = vi.fn();
    render(<ModaleDetailCommande
      commande={{ ...base, statut: 'a_faire' as const }} onFermer={onFermer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onFermer).toHaveBeenCalled();
  });
});
