import { describe, test, expect, vi, beforeEach } from 'vitest';
import { rechercherClientParCodeBarre, creerCommande, placerEmplacements, listerCommandes, modifierCommande, definirCintresEntreprise, resoudreScan, cloturerRepassage, marquerRecuperee } from './commandes';
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

describe('listerCommandes', () => {
  test('GET /api/commandes', async () => {
    const data = [{
      id_commande: 'c1', id_client: 'cl1', statut: 'a_faire', nombre_mannes: 2,
      prioritaire: false, cintres_client: false, cintres_entr_rendus: false,
      date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie',
    }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await listerCommandes();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes');
    expect(options.method ?? 'GET').toBe('GET');
    expect(r[0].client_nom).toBe('Dupont');
  });
});

describe('modifierCommande', () => {
  test('PUT /api/commandes/:id avec les scalaires', async () => {
    const maj = {
      id_commande: 'c1', id_client: 'cl1', statut: 'a_faire', nombre_mannes: 4,
      prioritaire: true, cintres_client: false, cintres_entr_rendus: false, date_reception: 'x',
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(maj), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await modifierCommande('c1', { nombre_mannes: 4, prioritaire: true, cintres_client: false, cintres_entr_rendus: false });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes/c1');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({
      nombre_mannes: 4, prioritaire: true, cintres_client: false, cintres_entr_rendus: false,
    });
  });
});

describe('definirCintresEntreprise', () => {
  test('PUT /api/commandes/:id/cintres-entreprise', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await definirCintresEntreprise('cmd1', 4);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes/cmd1/cintres-entreprise');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ cintres_entr_nb: 4 });
  });
});

describe('resoudreScan et cloturerRepassage (US #260)', () => {
  test('resoudreScan : GET /api/commandes/a-scanner/:code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ action: 'cloturer', commande: {} }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await resoudreScan('ABC123');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/commandes/a-scanner/ABC123');
  });

  test('cloturerRepassage : POST /api/commandes/:id/cloturer avec les emplacements', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const lignes = [{ id_emplacement: 'e1', nombre_mannes: 2 }];
    await cloturerRepassage('cmd1', lignes);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes/cmd1/cloturer');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ emplacements: lignes });
  });
});

describe('marquerRecuperee (US #280)', () => {
  test('POST /api/commandes/:id/recuperer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await marquerRecuperee('cmd1');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/commandes/cmd1/recuperer');
    expect(options.method).toBe('POST');
  });
});
