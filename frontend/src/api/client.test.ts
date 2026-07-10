import { describe, test, expect, vi, beforeEach } from 'vitest';
import { requeteApi, definirFournisseurJeton } from './client';

beforeEach(() => {
  definirFournisseurJeton(() => 'jeton-test');
});

describe('requeteApi', () => {
  test("attache l'en-tête Authorization: Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await requeteApi('/test');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer jeton-test');
  });

  test('gère une réponse 204 sans corps', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const resultat = await requeteApi('/vide');
    expect(resultat).toBeNull();
  });
});
