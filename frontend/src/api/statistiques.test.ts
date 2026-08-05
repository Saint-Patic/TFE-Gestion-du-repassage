import { describe, test, expect, vi, beforeEach } from 'vitest';
import { chargerStatistiques } from './statistiques';
import { definirFournisseurJeton } from './client';

beforeEach(() => {
  definirFournisseurJeton(() => 'jeton-test');
});

describe('chargerStatistiques (US #300)', () => {
  test('GET /api/statistiques avec les deux bornes', async () => {
    const data = { debut: '2026-08-01', fin: '2026-08-31', global: {}, parRepasseuse: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await chargerStatistiques('2026-08-01', '2026-08-31');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/statistiques?debut=2026-08-01&fin=2026-08-31');
  });
});
