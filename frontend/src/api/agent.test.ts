import { describe, test, expect, vi } from 'vitest';
import { imprimerEtiquette } from './agent';

const client = {
  id_client: 'abc', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
  email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
};

describe('imprimerEtiquette', () => {
  test('POST vers /imprimer avec nom/prenom/code_barre', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await imprimerEtiquette(client);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/imprimer$/);
    expect(JSON.parse(options.body)).toEqual({
      nom: 'Dupont', prenom: 'Marie', code_barre: 'K7QF2M9X',
    });
  });

  test('agent en erreur → lève', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(imprimerEtiquette(client)).rejects.toThrow();
  });
});
