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
});
