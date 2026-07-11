import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModaleConfirmation } from './ModaleConfirmation';

describe('ModaleConfirmation', () => {
  test('affiche titre/message et déclenche les callbacks', async () => {
    const onConfirmer = vi.fn();
    const onAnnuler = vi.fn();
    render(
      <ModaleConfirmation
        titre="Supprimer ?"
        message="Action définitive."
        libelleAction="Supprimer"
        onConfirmer={onConfirmer}
        onAnnuler={onAnnuler}
      />
    );
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument();
    expect(screen.getByText('Action définitive.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onConfirmer).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onAnnuler).toHaveBeenCalled();
  });
});
