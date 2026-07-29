import { describe, test, expect, vi, beforeEach } from 'vitest';
import { listerEmplacements } from './emplacements';
import { definirFournisseurJeton } from './client';

beforeEach(() => {
  definirFournisseurJeton(() => 'jeton-test');
});

describe('listerEmplacements', () => {
  test('GET /api/emplacements', async () => {
    const emplacements = [
      { id_emplacement: 'e1', code_barre: 'A1G', etagere: 'A', niveau: 1, position: 'gauche' },
    ];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(emplacements), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await listerEmplacements();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/emplacements');
    expect(options.method ?? 'GET').toBe('GET');
    expect(r[0].code_barre).toBe('A1G');
  });
});
