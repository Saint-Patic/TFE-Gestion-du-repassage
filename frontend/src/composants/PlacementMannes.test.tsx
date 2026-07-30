import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlacementMannes } from './PlacementMannes';

const emplacements = [
  { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche' },
  { id_emplacement: 'e2', code_barre: 'B2C', etagere: 'B', niveau: 2, position: 'centre' },
];

describe('PlacementMannes', () => {
  test('scanner N emplacements décrémente le reste puis Terminer remonte la répartition', async () => {
    const onTerminer = vi.fn();
    render(<PlacementMannes nombreMannes={2} emplacements={emplacements} onTerminer={onTerminer} />);
    expect(screen.getByText(/reste 2/)).toBeInTheDocument();
    const champ = screen.getByPlaceholderText('Code emplacement');
    await userEvent.type(champ, 'A1G{enter}');
    expect(screen.getByText(/reste 1/)).toBeInTheDocument();
    await userEvent.type(champ, 'A1G{enter}');
    expect(screen.getByText(/reste 0/)).toBeInTheDocument();
    const terminer = screen.getByRole('button', { name: /Terminer/ });
    expect(terminer).toBeEnabled();
    await userEvent.click(terminer);
    expect(onTerminer).toHaveBeenCalledWith([{ id_emplacement: 'e1', nombre_mannes: 2 }]);
  });

  test('emplacement inconnu → message, reste inchangé', async () => {
    render(<PlacementMannes nombreMannes={1} emplacements={emplacements} onTerminer={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Code emplacement'), 'ZZZ{enter}');
    expect(await screen.findByText(/Emplacement inconnu/)).toBeInTheDocument();
    expect(screen.getByText(/reste 1/)).toBeInTheDocument();
  });

  test('annuler le dernier scan réincrémente le reste', async () => {
    render(<PlacementMannes nombreMannes={2} emplacements={emplacements} onTerminer={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Code emplacement'), 'A1G{enter}');
    expect(screen.getByText(/reste 1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Annuler le dernier scan/ }));
    expect(screen.getByText(/reste 2/)).toBeInTheDocument();
  });
});
