import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/statistiques', () => ({ chargerStatistiques: vi.fn() }));

import { Statistiques } from './Statistiques';
import { chargerStatistiques } from '../api/statistiques';

const donnees = {
  debut: '2026-08-01', fin: '2026-08-31',
  global: { nbCommandes: 8, tempsTotalS: 25800, totalMannes: 21,
            moyenneParCommandeS: 3225, moyenneParManneS: 1229 },
  parRepasseuse: [
    { id_utilisateur: 'u1', repasseuse: 'Sophie', nbCommandes: 7, tempsTotalS: 25200,
      totalMannes: 20, moyenneParCommandeS: 3600, moyenneParManneS: 1260 },
  ],
};

function rendre() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Statistiques />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(chargerStatistiques).mockReset();
});

describe('Statistiques', () => {
  test('affiche les indicateurs globaux', async () => {
    vi.mocked(chargerStatistiques).mockResolvedValue(donnees as never);
    rendre();
    expect(await screen.findByText(/8 commande\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/07:10:00/)).toBeInTheDocument(); // 25800 s
  });

  test('liste une ligne par repasseuse', async () => {
    vi.mocked(chargerStatistiques).mockResolvedValue(donnees as never);
    rendre();
    expect(await screen.findByText('Sophie')).toBeInTheDocument();
  });

  test('période sans commande → message explicite', async () => {
    vi.mocked(chargerStatistiques).mockResolvedValue({
      ...donnees,
      global: { nbCommandes: 0, tempsTotalS: 0, totalMannes: 0, moyenneParCommandeS: 0, moyenneParManneS: 0 },
      parRepasseuse: [],
    } as never);
    rendre();
    expect(await screen.findByText(/aucune commande terminée/i)).toBeInTheDocument();
  });
});
