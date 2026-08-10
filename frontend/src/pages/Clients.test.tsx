import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/clients', () => ({
  listerClients: vi.fn(),
  modifierClient: vi.fn(),
  supprimerClient: vi.fn(),
}));

vi.mock('../api/agent', () => ({
  imprimerEtiquette: vi.fn(),
}));

import { Clients } from './Clients';
import { listerClients, modifierClient, supprimerClient } from '../api/clients';
import { imprimerEtiquette } from '../api/agent';

const liste = [
  { id_client: '1', nom: 'Dupont', prenom: 'Marie', telephone: '0470', email: null, code_barre: 'AB', date_creation: 'x' },
  { id_client: '2', nom: 'Martin', prenom: 'Jean', telephone: '0475', email: null, code_barre: 'CD', date_creation: 'x' },
];

function rendre() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Clients />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(listerClients).mockReset();
  vi.mocked(modifierClient).mockReset();
  vi.mocked(supprimerClient).mockReset();
  vi.mocked(imprimerEtiquette).mockReset();
  vi.mocked(imprimerEtiquette).mockResolvedValue(undefined);
});

describe('Clients', () => {
  test('affiche la liste et filtre par recherche', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    expect(await screen.findByText(/Dupont Marie/)).toBeInTheDocument();
    expect(screen.getByText(/Martin Jean/)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Rechercher…'), 'dupont');
    expect(screen.queryByText(/Martin Jean/)).not.toBeInTheDocument();
  });

  test('clic ✎ ouvre la modale pré-remplie et enregistre', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(modifierClient).mockResolvedValue(liste[0]);
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Modifier le client'))[0]);
    expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(modifierClient).toHaveBeenCalledWith('1', expect.objectContaining({ nom: 'Dupont' }));
  });

  test('clic ✕ puis confirmation appelle supprimerClient', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(supprimerClient).mockResolvedValue({ supprime: true, commandes_detachees: 0 });
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Supprimer le client'))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(supprimerClient).toHaveBeenCalledWith('1');
  });

  // Le message doit dire ce qui est CONSERVÉ, pas seulement ce qui est supprimé : c'est la
  // garantie que la gérante a besoin de lire avant de cliquer.
  test('suppression réussie : le message annonce les commandes conservées', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(supprimerClient).mockResolvedValue({ supprime: true, commandes_detachees: 12 });
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Supprimer le client'))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(
      await screen.findByText(/12 commande\(s\) conservées dans les statistiques/)
    ).toBeInTheDocument();
  });

  // Le refus vient du serveur (409) et porte un compte : on affiche SON message, sans le
  // reformuler côté client, sinon les deux formulations divergeront.
  test('refus du serveur : le message du serveur s’affiche et la liste ne bouge pas', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(supprimerClient).mockRejectedValue({
      statut: 409,
      corps: { message: '2 commande(s) non récupérée(s) : terminez la remise avant de supprimer.' },
    });
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Supprimer le client'))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText(/2 commande\(s\) non récupérée\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/Dupont Marie/)).toBeInTheDocument();
  });

  // Le code-barres n'était affiché qu'une fois, sur l'écran de création. Une étiquette
  // perdue le rendait donc introuvable, alors qu'il permet la saisie au clavier quand
  // l'imprimante est en panne (le scanner est un clavier, cf. #150).
  test('la liste affiche le code-barres de chaque client', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    expect(await screen.findByText('AB')).toBeInTheDocument();
    expect(screen.getByText('CD')).toBeInTheDocument();
  });

  test('la recherche trouve un client par son code-barres', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    await screen.findByText(/Martin Jean/);
    await userEvent.type(screen.getByPlaceholderText('Rechercher…'), 'cd');
    expect(screen.getByText(/Martin Jean/)).toBeInTheDocument();
    expect(screen.queryByText(/Dupont Marie/)).not.toBeInTheDocument();
  });

  // Une étiquette collée s'abîme ou se perd, et le code-barres appartient au CLIENT :
  // sans réimpression, la cliente devenait définitivement non scannable (#340).
  test('clic 🖨 réimprime l’étiquette du client de la ligne', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Réimprimer l’étiquette'))[0]);
    expect(imprimerEtiquette).toHaveBeenCalledWith(liste[0]);
    expect(await screen.findByText(/étiquette envoyée/i)).toBeInTheDocument();
  });

  test('si l’agent d’impression ne répond pas, le message le dit', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    vi.mocked(imprimerEtiquette).mockRejectedValue(new Error('injoignable'));
    rendre();
    await userEvent.click((await screen.findAllByLabelText('Réimprimer l’étiquette'))[0]);
    expect(await screen.findByText(/agent d’impression/i)).toBeInTheDocument();
  });

  test('chaque ligne porte un lien vers l’historique du client (US #290)', async () => {
    vi.mocked(listerClients).mockResolvedValue(liste);
    rendre();
    await screen.findByText(/Dupont Marie/);
    const liens = screen.getAllByLabelText('Historique du client');
    expect(liens).toHaveLength(2);
    expect(liens[0]).toHaveAttribute('href', '/clients/1/historique');
  });
});
