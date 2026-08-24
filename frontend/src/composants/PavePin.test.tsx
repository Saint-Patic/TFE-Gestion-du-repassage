import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PavePin } from './PavePin';

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
});
