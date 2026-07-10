import { describe, test, expect, vi, beforeEach } from 'vitest';
import { creerClient } from './clients';
import { definirFournisseurJeton } from './client';

beforeEach(() => {
  definirFournisseurJeton(() => 'jeton-test');
});

describe('creerClient', () => {
  test('POST /api/clients avec le corps du client', async () => {
    const client = {
      id_client: 'abc', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
      email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(client), { status: 201 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const resultat = await creerClient({ nom: 'Dupont', prenom: 'Marie', telephone: '0470' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clients');
    expect(options.method).toBe('POST');
    expect(resultat.code_barre).toBe('K7QF2M9X');
  });
});
