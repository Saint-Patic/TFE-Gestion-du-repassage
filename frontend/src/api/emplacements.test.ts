import { describe, test, expect, vi, beforeEach } from 'vitest';
import { listerEmplacements, contenuEmplacement, deplacerEmplacement } from './emplacements';
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

describe('contenuEmplacement', () => {
  test('GET /api/emplacements/:id/contenu', async () => {
    const contenu = [
      { id_commande: 'c1', nombre_mannes: 2, statut: 'a_faire', id_client: 'cl1', client_nom: 'Dupont', client_prenom: 'Marie' },
    ];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(contenu), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await contenuEmplacement('e1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/emplacements/e1/contenu');
    expect(r[0].client_nom).toBe('Dupont');
  });
});

describe('deplacerEmplacement', () => {
  test('POST /api/emplacements/deplacer avec le bon corps', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await deplacerEmplacement('src', 'dst', 'cl1');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/emplacements/deplacer');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ id_source: 'src', id_destination: 'dst', id_client: 'cl1' });
  });
});
