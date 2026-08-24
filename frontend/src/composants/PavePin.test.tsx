import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PavePin } from './PavePin';

// jsdom n'implémente pas matchMedia : chaque test déclare l'appareil qu'il simule.
function simulerAppareil(pointeurPrecis: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (requete: string) => ({ matches: pointeurPrecis, media: requete }),
  });
}

beforeEach(() => simulerAppareil(false));

describe('PavePin', () => {
  test('appelle onComplet avec un PIN à 4 chiffres', async () => {
    const onComplet = vi.fn();
    render(<PavePin onComplet={onComplet} />);
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onComplet).toHaveBeenCalledWith('1234');
  });

  test('la touche Effacer retire le dernier chiffre saisi', async () => {
    const onComplet = vi.fn();
    render(<PavePin onComplet={onComplet} />);
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onComplet).toHaveBeenCalledWith('1245');
  });

  test('la touche Effacer est désactivée tant que rien n’est saisi', async () => {
    render(<PavePin onComplet={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeEnabled();
  });

  test('sur ordinateur, taper au clavier compose le PIN', async () => {
    simulerAppareil(true);
    const onComplet = vi.fn();
    render(<PavePin onComplet={onComplet} />);
    await userEvent.keyboard('1234');
    expect(onComplet).toHaveBeenCalledWith('1234');
  });

  test('sur ordinateur, Backspace efface le dernier chiffre', async () => {
    simulerAppareil(true);
    const onComplet = vi.fn();
    render(<PavePin onComplet={onComplet} />);
    await userEvent.keyboard('123{Backspace}45');
    expect(onComplet).toHaveBeenCalledWith('1245');
  });

  // Sans ce test, rien ne distingue « ordinateur seulement » de « partout » : sur tablette
  // le scanner est un clavier HID et composerait le PIN tout seul.
  test('sur tablette, le clavier physique est ignoré', async () => {
    simulerAppareil(false);
    const onComplet = vi.fn();
    render(<PavePin onComplet={onComplet} />);
    await userEvent.keyboard('1234');
    expect(onComplet).not.toHaveBeenCalled();
  });

  test('les touches non numériques sont ignorées', async () => {
    simulerAppareil(true);
    const onComplet = vi.fn();
    render(<PavePin onComplet={onComplet} />);
    await userEvent.keyboard('a1b2c3d4');
    expect(onComplet).toHaveBeenCalledWith('1234');
  });
});
