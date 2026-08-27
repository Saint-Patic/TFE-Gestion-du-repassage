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

  test('commande prioritaire → carte surlignée en rouge', () => {
    const { container } = render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} />);
    expect(container.querySelector('.border-red-500')).toBeTruthy();
  });

  test('commande non prioritaire → pas de surlignage rouge', () => {
    const { container } = render(<CarteCommande commande={{ ...base, prioritaire: false, statut: 'a_faire' }} />);
    expect(container.querySelector('.border-red-500')).toBeFalsy();
  });

  test('carte « en cours » affiche un chrono HH:MM:SS', () => {
    const now = new Date('2026-07-31T10:00:00Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    render(<CarteCommande commande={{
      ...base, statut: 'en_cours', repassage_debut: new Date(now).toISOString(), temps_repassage_s: 0,
    }} />);
    expect(screen.getByText(/^\d\d:\d\d:\d\d$/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  test('carte « à faire » n’affiche pas de chrono', () => {
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} />);
    expect(screen.queryByText(/^\d\d:\d\d:\d\d$/)).not.toBeInTheDocument();
  });

  test('carte « en cours » en marche → bouton Pause (pas Reprendre)', async () => {
    const onPause = vi.fn();
    render(<CarteCommande
      commande={{ ...base, statut: 'en_cours', repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }}
      onPause={onPause} onReprendre={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalled();
  });

  test('carte « en cours » en pause → bouton Reprendre (pas Pause)', async () => {
    const onReprendre = vi.fn();
    render(<CarteCommande
      commande={{ ...base, statut: 'en_cours', repassage_debut: null, temps_repassage_s: 42 }}
      onPause={vi.fn()} onReprendre={onReprendre} />);
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(onReprendre).toHaveBeenCalled();
  });

  test('carte « en cours » : saisir les cintres entreprise appelle onCintresEntreprise', async () => {
    const onCintres = vi.fn();
    render(<CarteCommande
      commande={{ ...base, statut: 'en_cours', repassage_debut: null, temps_repassage_s: 0 }}
      onCintresEntreprise={onCintres} />);
    // Correspondance exacte : les boutons du pavé portent aussi « cintres entreprise »
    // dans leur libellé d'accessibilité (« Augmenter cintres entreprise »).
    const champ = screen.getByLabelText('Cintres entreprise');
    await userEvent.type(champ, '4');
    await userEvent.tab(); // blur
    expect(onCintres).toHaveBeenCalledWith(expect.objectContaining({ id_commande: base.id_commande }), 4);
  });

  test('carte « à faire » : pas de champ cintres entreprise', () => {
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} onCintresEntreprise={vi.fn()} />);
    expect(screen.queryByLabelText(/Cintres entreprise/i)).not.toBeInTheDocument();
  });

  test('carte « fait » sans mobile → badge « à appeler » (US #270)', () => {
    render(<CarteCommande commande={{ ...base, statut: 'fait' as const, client_mobile: false }} />);
    expect(screen.getByText(/à appeler/i)).toBeInTheDocument();
  });

  test('carte « fait » avec mobile → pas de badge (US #270)', () => {
    render(<CarteCommande commande={{ ...base, statut: 'fait' as const, client_mobile: true }} />);
    expect(screen.queryByText(/à appeler/i)).not.toBeInTheDocument();
  });
  test('clic sur la carte → onOuvrir', async () => {
    const onOuvrir = vi.fn();
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} onOuvrir={onOuvrir} />);
    await userEvent.click(screen.getByText(/Marie Dupont/));
    expect(onOuvrir).toHaveBeenCalledWith(expect.objectContaining({ id_commande: 'c1' }));
  });

  test('clic sur « Pause » → n’ouvre PAS la modale', async () => {
    const onOuvrir = vi.fn();
    const onPause = vi.fn();
    render(<CarteCommande
      commande={{ ...base, statut: 'en_cours', repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }}
      onOuvrir={onOuvrir} onPause={onPause} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalled();
    expect(onOuvrir).not.toHaveBeenCalled();
  });

  test('clic sur « Modifier » → n’ouvre PAS la modale', async () => {
    const onOuvrir = vi.fn();
    const onModifier = vi.fn();
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }}
      onOuvrir={onOuvrir} onModifier={onModifier} />);
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(onModifier).toHaveBeenCalled();
    expect(onOuvrir).not.toHaveBeenCalled();
  });

  test('clic sur le pavé des cintres → n’ouvre PAS la modale', async () => {
    const onOuvrir = vi.fn();
    const onCintres = vi.fn();
    render(<CarteCommande
      commande={{ ...base, statut: 'en_cours', repassage_debut: null, temps_repassage_s: 0, cintres_entr_nb: 2 }}
      onOuvrir={onOuvrir} onCintresEntreprise={onCintres} />);
    await userEvent.click(screen.getByRole('button', { name: 'Augmenter cintres entreprise' }));
    expect(onCintres).toHaveBeenCalledWith(expect.objectContaining({ id_commande: 'c1' }), 3);
    expect(onOuvrir).not.toHaveBeenCalled();
  });

  test('sans onOuvrir → la carte n’est pas annoncée comme un bouton', () => {
    render(<CarteCommande commande={{ ...base, statut: 'a_faire' }} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('carte occupant une case → emplacement affiché sur la carte', () => {
    render(<CarteCommande commande={{ ...base, statut: 'a_faire',
      emplacements: [{ code_barre: 'A1G', nombre_mannes: 3 }] }} />);
    expect(screen.getByText('A1G (3)')).toBeInTheDocument();
  });

  test('carte occupant plusieurs cases → emplacements listés', () => {
    render(<CarteCommande commande={{ ...base, statut: 'fait',
      emplacements: [{ code_barre: 'A1G', nombre_mannes: 1 }, { code_barre: 'B2C', nombre_mannes: 2 }] }} />);
    expect(screen.getByText('A1G (1), B2C (2)')).toBeInTheDocument();
  });

  test('carte sans emplacement → rien affiché, pas de tiret', () => {
    render(<CarteCommande commande={{ ...base, statut: 'en_cours',
      repassage_debut: null, temps_repassage_s: 0, emplacements: [] }} />);
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});
