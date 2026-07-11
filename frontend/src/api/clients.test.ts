import { describe, test, expect, vi, beforeEach } from 'vitest';
import { creerClient, listerClients, modifierClient, supprimerClient } from './clients';
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

describe('listerClients / modifierClient / supprimerClient', () => {
  test('listerClients → GET /api/clients', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await listerClients();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clients');
    expect(options.method ?? 'GET').toBe('GET');
  });

  test('modifierClient → PUT /api/clients/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await modifierClient('abc', { nom: 'D', prenom: 'L', telephone: '0480' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clients/abc');
    expect(options.method).toBe('PUT');
  });

  test('supprimerClient → DELETE /api/clients/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ anonymise: false }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await supprimerClient('abc');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clients/abc');
    expect(options.method).toBe('DELETE');
    expect(r.anonymise).toBe(false);
  });
});
