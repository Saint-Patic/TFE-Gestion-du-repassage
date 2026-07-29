import { describe, test, expect, vi, beforeEach } from 'vitest';
import { rechercherClientParCodeBarre, creerCommande, placerEmplacements } from './commandes';
import { definirFournisseurJeton } from './client';

beforeEach(() => {
  definirFournisseurJeton(() => 'jeton-test');
});

describe('rechercherClientParCodeBarre', () => {
  test('GET /api/clients/code-barre/:code', async () => {
    const client = {
      id_client: 'abc', nom: 'Dupont', prenom: 'Marie', telephone: '0470',
      email: null, code_barre: 'K7QF2M9X', date_creation: 'x',
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(client), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await rechercherClientParCodeBarre('K7QF2M9X');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clients/code-barre/K7QF2M9X');
    expect(options.method ?? 'GET').toBe('GET');
    expect(r.code_barre).toBe('K7QF2M9X');
  });
});

describe('creerCommande', () => {
  test('POST /api/commandes transmet id_client, mannes et les 3 flags', async () => {
    const commande = {
      id_commande: 'cmd1', id_client: 'abc', statut: 'a_faire',
      nombre_mannes: 3, prioritaire: true, cintres_client: false,
      cintres_entr_rendus: true, date_reception: 'x',
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(commande), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await creerCommande({
      id_client: 'abc', nombre_mannes: 3,
      prioritaire: true, cintres_client: false, cintres_entr_rendus: true,
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      id_client: 'abc', nombre_mannes: 3,
      prioritaire: true, cintres_client: false, cintres_entr_rendus: true,
    });
    expect(r.statut).toBe('a_faire');
  });
});

describe('placerEmplacements', () => {
  test('POST /api/commandes/:id/emplacements avec la répartition', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await placerEmplacements('cmd1', [{ id_emplacement: 'e1', nombre_mannes: 2 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes/cmd1/emplacements');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ emplacements: [{ id_emplacement: 'e1', nombre_mannes: 2 }] });
  });
});
