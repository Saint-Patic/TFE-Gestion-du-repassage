import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/commandes', () => ({
  listerCommandes: vi.fn(),
  modifierCommande: vi.fn(),
  placerEmplacements: vi.fn(),
  demarrerRepassage: vi.fn(),
  mettreEnPause: vi.fn(),
  reprendreRepassage: vi.fn(),
  definirCintresEntreprise: vi.fn(),
  resoudreScan: vi.fn(),
  cloturerRepassage: vi.fn(),
  marquerRecuperee: vi.fn(),
  rechercherClientParCodeBarre: vi.fn(),
  creerCommande: vi.fn(),
}));
vi.mock('../api/emplacements', () => ({
  listerEmplacements: vi.fn(),
  contenuEmplacement: vi.fn(),
  deplacerEmplacement: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

let handlers: Record<string, () => void> = {};
const fauxSocket = {
  on: (evt: string, h: () => void) => { handlers[evt] = h; },
  off: () => {},
};
vi.mock('../temps-reel/socket', () => ({ obtenirSocket: () => fauxSocket }));

import { Tableau } from './Tableau';
import { listerCommandes, demarrerRepassage, resoudreScan, cloturerRepassage, marquerRecuperee } from '../api/commandes';
import { listerEmplacements } from '../api/emplacements';
import { useAuth } from '../auth/AuthContext';

const commandes = [
  { id_commande: 'c1', id_client: 'cl1', statut: 'a_faire' as const, nombre_mannes: 2, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, date_reception: 'x', client_nom: 'Dupont', client_prenom: 'Marie' },
  { id_commande: 'c2', id_client: 'cl2', statut: 'recupere' as const, nombre_mannes: 1, prioritaire: false,
    cintres_client: false, cintres_entr_rendus: false, date_reception: 'x', client_nom: 'Martin', client_prenom: 'Jean' },
];

function connecte(role: string) {
  vi.mocked(useAuth).mockReturnValue({ utilisateur: { id_utilisateur: 'u', nom: 'X', role } } as never);
}

function rendre() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  render(<QueryClientProvider client={qc}><Tableau /></QueryClientProvider>);
  return { qc, spy };
}

beforeEach(() => {
  handlers = {};
  vi.mocked(listerCommandes).mockReset().mockResolvedValue(commandes);
  vi.mocked(listerEmplacements).mockReset().mockResolvedValue([]);
  vi.mocked(demarrerRepassage).mockReset().mockResolvedValue(commandes[0]);
  // Défaut « démarrer » : sans lui, le test existant de démarrage recevrait undefined
  // de resoudreScan et la déstructuration lèverait.
  vi.mocked(resoudreScan).mockReset().mockResolvedValue({
    commandes: [
      { id_commande: 'c1', id_client: 'cl1', statut: 'a_faire', nombre_mannes: 2, action: 'demarrer' },
    ],
  } as never);
  vi.mocked(cloturerRepassage).mockReset().mockResolvedValue(commandes[0] as never);
  vi.mocked(marquerRecuperee).mockReset().mockResolvedValue(commandes[0] as never);
  connecte('repasseuse');
});

const commandePrete = {
  commandes: [
    {
      id_commande: 'c9', id_client: 'cl1', statut: 'fait', nombre_mannes: 2, action: 'recuperer',
      client_nom: 'Dupont', client_prenom: 'Marie',
    },
  ],
};

const commandeEnCours = {
  commandes: [
    {
      id_commande: 'c9', id_client: 'cl1', statut: 'en_cours', nombre_mannes: 2, action: 'cloturer',
      client_nom: 'Dupont', client_prenom: 'Marie', client_mobile: true,
    },
  ],
};

// Un scan de clôture passe désormais par une confirmation (2026-08-25).
async function scannerPuisConfirmer() {
  const champ = await screen.findByPlaceholderText('Scanner le client');
  await userEvent.type(champ, 'ABC123{enter}');
  await userEvent.click(await screen.findByRole('button', { name: 'Terminer et replacer' }));
}

describe('Tableau', () => {
  test('affiche les 4 colonnes, dont « Récupéré » borné au jour', async () => {
    rendre();
    expect(await screen.findByText('À faire')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Fait')).toBeInTheDocument();
    // Le serveur ne renvoie que les remises du jour (`date_recuperation::date = CURRENT_DATE`,
    // routes/commandes.js). Le libellé doit le dire : sans cette précision, une repasseuse
    // pourrait croire que les remises de la veille ont été perdues.
    expect(screen.getByText('Récupéré (aujourd’hui)')).toBeInTheDocument();
  });

  test('un événement commandes:maj invalide la requête commandes', async () => {
    const { spy } = rendre();
    await screen.findByText('À faire');
    spy.mockClear();
    handlers['commandes:maj']();
    expect(spy).toHaveBeenCalledWith({ queryKey: ['commandes'] });
  });

  test('repasseuse : scanner un client appelle demarrerRepassage', async () => {
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(demarrerRepassage).toHaveBeenCalledWith('c1');
    // Une seule candidate : pas de pop-up, le parcours courant ne gagne aucun geste.
    expect(screen.queryByText(/commandes pour/i)).not.toBeInTheDocument();
  });

  test('gérante : pas de champ de scan', async () => {
    connecte('gerante');
    rendre();
    await screen.findByText('À faire');
    expect(screen.queryByPlaceholderText('Scanner le client')).not.toBeInTheDocument();
  });

  test('scan d’une commande en cours → confirmation avant le placement (2026-08-25)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandeEnCours as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(await screen.findByText(/Un SMS la préviendra/i)).toBeInTheDocument();
    // Le placement ne s'ouvre pas tant que la confirmation n'est pas donnée.
    expect(screen.queryByText(/reste/i)).not.toBeInTheDocument();
    expect(demarrerRepassage).not.toHaveBeenCalled();
  });

  test('confirmer ouvre la phase de placement (US #260)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandeEnCours as never);
    rendre();
    await scannerPuisConfirmer();
    expect(await screen.findByText(/reste/i)).toBeInTheDocument();
    expect(cloturerRepassage).not.toHaveBeenCalled();
  });

  // C'est le test qui porte la demande : annuler ne doit rien écrire du tout.
  test('annuler la confirmation n’écrit rien et n’ouvre pas le placement (2026-08-25)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandeEnCours as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await screen.findByText(/Un SMS la préviendra/i);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(cloturerRepassage).not.toHaveBeenCalled();
    expect(screen.queryByText(/reste/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Un SMS la préviendra/i)).not.toBeInTheDocument();
  });

  test('annuler la confirmation rend le focus au champ de scan (2026-08-25)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandeEnCours as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await screen.findByText(/Un SMS la préviendra/i);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(champ).toHaveFocus();
  });

  test('cliente au fixe : la confirmation annonce un appel (2026-08-25)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue({
      commandes: [{ ...commandeEnCours.commandes[0], client_mobile: false }],
    } as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(await screen.findByText(/cette cliente est à appeler/i)).toBeInTheDocument();
    expect(screen.queryByText(/Un SMS la préviendra/i)).not.toBeInTheDocument();
  });

  // Le test qui verrouille le « === true » : sans lui, un « !== false » passerait aussi,
  // et un champ manquant promettrait un SMS fantôme (défaut S3 du #270).
  test('client_mobile absent : on ne promet aucun SMS (2026-08-25)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue({
      commandes: [{ ...commandeEnCours.commandes[0], client_mobile: undefined }],
    } as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(await screen.findByText(/cette cliente est à appeler/i)).toBeInTheDocument();
  });

  test('scan d’une commande prête → confirmation, sans rien écrire (US #280)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandePrete as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(await screen.findByText(/Remettre la commande de Marie Dupont/i)).toBeInTheDocument();
    expect(marquerRecuperee).not.toHaveBeenCalled();
  });

  test('confirmer la remise appelle marquerRecuperee (US #280)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandePrete as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await screen.findByText(/Remettre la commande de Marie Dupont/i);
    await userEvent.click(screen.getByRole('button', { name: 'Remettre' }));
    expect(marquerRecuperee).toHaveBeenCalledWith('c9');
  });

  test('annuler la remise n’écrit rien (US #280)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandePrete as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await screen.findByText(/Remettre la commande de Marie Dupont/i);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(marquerRecuperee).not.toHaveBeenCalled();
    expect(screen.queryByText(/Remettre la commande/i)).not.toBeInTheDocument();
  });

  test('Annuler pendant la clôture revient au Kanban sans rien écrire (US #260)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandeEnCours as never);
    rendre();
    await scannerPuisConfirmer();
    await screen.findByText(/reste/i);
    await userEvent.click(screen.getByRole('button', { name: 'Annuler la clôture' }));
    expect(screen.queryByText(/reste/i)).not.toBeInTheDocument();
    expect(cloturerRepassage).not.toHaveBeenCalled();
  });
  test('clic sur une carte → ouvre la modale de détail', async () => {
    rendre();
    await userEvent.click(await screen.findByText(/Marie Dupont/));
    const dialogue = await screen.findByRole('dialog');
    expect(within(dialogue).getByText('Marie Dupont')).toBeInTheDocument();
  });

  // La modale dérive la commande de la liste : sans cela, une mise en pause venue d'une
  // autre tablette la laisserait sur « Pause ».
  test('la modale suit le temps réel', async () => {
    const enMarche = [{ ...commandes[0], statut: 'en_cours' as const,
      repassage_debut: new Date().toISOString(), temps_repassage_s: 0 }];
    const enPause = [{ ...enMarche[0], repassage_debut: null, temps_repassage_s: 12 }];
    vi.mocked(listerCommandes).mockReset()
      .mockResolvedValueOnce(enMarche as never)
      .mockResolvedValue(enPause as never);

    rendre();
    await userEvent.click(await screen.findByText(/Marie Dupont/));
    const dialogue = await screen.findByRole('dialog');
    expect(within(dialogue).getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    handlers['commandes:maj']();

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reprendre' }))
        .toBeInTheDocument();
    });
  });

  const deuxCommandes = {
    commandes: [
      { id_commande: 'c9', id_client: 'cl1', statut: 'fait', nombre_mannes: 1, action: 'recuperer',
        prioritaire: false, date_reception: '2026-08-21T09:00:00Z',
        client_nom: 'Dupont', client_prenom: 'Marie' },
      { id_commande: 'c8', id_client: 'cl1', statut: 'a_faire', nombre_mannes: 2, action: 'demarrer',
        prioritaire: false, date_reception: '2026-08-24T09:00:00Z',
        client_nom: 'Dupont', client_prenom: 'Marie' },
    ],
  };

  test('deux commandes → pop-up de choix, sans rien écrire (2026-08-24)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(deuxCommandes as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    expect(await screen.findByText('2 commandes pour Marie Dupont')).toBeInTheDocument();
    expect(demarrerRepassage).not.toHaveBeenCalled();
    expect(marquerRecuperee).not.toHaveBeenCalled();
  });

  // Discriminant : asserter l'ARGUMENT. « la fonction a été appelée » passerait aussi
  // avec l'ancienne route par code-barres, qui aurait démarré l'autre commande.
  test('choisir la seconde ligne démarre CETTE commande (2026-08-24)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(deuxCommandes as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await userEvent.click(await screen.findByText('Démarrer'));
    expect(demarrerRepassage).toHaveBeenCalledWith('c8');
  });

  test('choisir « Remettre » enchaîne sur la confirmation, sans écrire (2026-08-24)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(deuxCommandes as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await userEvent.click(await screen.findByText('Remettre'));
    expect(await screen.findByText(/Remettre la commande de Marie Dupont/i)).toBeInTheDocument();
    expect(marquerRecuperee).not.toHaveBeenCalled();
  });

  test('annuler le choix ferme la pop-up et rend le focus au champ (2026-08-24)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(deuxCommandes as never);
    rendre();
    const champ = await screen.findByPlaceholderText('Scanner le client');
    await userEvent.type(champ, 'ABC123{enter}');
    await screen.findByText('2 commandes pour Marie Dupont');
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('2 commandes pour Marie Dupont')).not.toBeInTheDocument();
    expect(demarrerRepassage).not.toHaveBeenCalled();
    expect(champ).toHaveFocus();
  });

  // Le test qui porte la décision fondatrice : jamais deux cibles de scan actives.
  test('ouvrir la réception fait disparaître le champ de scan (2026-08-25)', async () => {
    rendre();
    await userEvent.click(await screen.findByRole('button', { name: '+ Nouvelle réception' }));
    expect(await screen.findByText('Nouvelle réception')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Scanner le client')).not.toBeInTheDocument();
  });

  test('fermer la réception ramène le champ de scan et son focus (2026-08-25)', async () => {
    rendre();
    await userEvent.click(await screen.findByRole('button', { name: '+ Nouvelle réception' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    const champ = await screen.findByPlaceholderText('Scanner le client');
    expect(champ).toHaveFocus();
  });

  test('repasseuse : ouvrir la réorganisation fait disparaître le champ de scan (2026-08-25)', async () => {
    rendre();
    await userEvent.click(await screen.findByRole('button', { name: 'Réorganiser' }));
    expect(await screen.findByText('Réorganiser les emplacements')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Scanner le client')).not.toBeInTheDocument();
  });

  test('gérante : réception oui, champ de scan et réorganisation non (2026-08-25)', async () => {
    connecte('gerante');
    rendre();
    expect(await screen.findByRole('button', { name: '+ Nouvelle réception' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Scanner le client')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réorganiser' })).not.toBeInTheDocument();
  });

  // Pendant une clôture, la barre du haut n'existe pas : aucun autre panneau ne peut s'ouvrir.
  test('pendant une clôture, les boutons de panneau ont disparu (2026-08-25)', async () => {
    vi.mocked(resoudreScan).mockResolvedValue(commandeEnCours as never);
    rendre();
    await scannerPuisConfirmer();
    await screen.findByText(/reste/i);
    expect(screen.queryByRole('button', { name: '+ Nouvelle réception' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réorganiser' })).not.toBeInTheDocument();
  });
});
