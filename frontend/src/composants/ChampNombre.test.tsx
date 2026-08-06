import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChampNombre } from './ChampNombre';

describe('ChampNombre', () => {
  test('« + » augmente la valeur', async () => {
    const onChange = vi.fn();
    render(<ChampNombre libelle="nombre de mannes" valeur={2} min={1} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Augmenter nombre de mannes'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test('« − » diminue la valeur', async () => {
    const onChange = vi.fn();
    render(<ChampNombre libelle="nombre de mannes" valeur={2} min={1} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Diminuer nombre de mannes'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  // Sans cette borne, la repasseuse pourrait descendre à 0 manne au doigt et se faire
  // refuser la réception par le serveur, sans comprendre pourquoi.
  test('« − » est désactivé à la borne minimale', () => {
    render(<ChampNombre libelle="nombre de mannes" valeur={1} min={1} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Diminuer nombre de mannes')).toBeDisabled();
  });

  // Le poste de la gérante a un clavier : la saisie directe doit rester possible, y compris
  // le passage par un champ vide entre deux frappes.
  test('la saisie au clavier reste possible après avoir vidé le champ', async () => {
    const onChange = vi.fn();
    render(<ChampNombre id="n" libelle="nombre de mannes" valeur={1} min={1} onChange={onChange} />);
    // Le libellé visible appartient à l'appelant : on cible donc le champ par son rôle.
    const champ = screen.getByRole('spinbutton');
    await userEvent.clear(champ);
    await userEvent.type(champ, '7');
    expect(onChange).toHaveBeenLastCalledWith(7);
  });
});
