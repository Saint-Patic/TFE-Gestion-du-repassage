import { requeteApi } from './client';
import type { Client, Commande, CommandeAScanner, CommandeCarte } from './types';

// Recherche un client par son code-barres (encodage d'une réception).
export function rechercherClientParCodeBarre(code: string): Promise<Client> {
  return requeteApi<Client>(`/clients/code-barre/${encodeURIComponent(code)}`);
}

// Crée une commande (réception) : client + nombre de mannes + flags (cintres / prioritaire).
export function creerCommande(
  donnees: {
    id_client: string;
    nombre_mannes: number;
    prioritaire?: boolean;
    cintres_client?: boolean;
    cintres_entr_rendus?: boolean;
  }
): Promise<Commande> {
  return requeteApi<Commande>('/commandes', {
    method: 'POST',
    body: JSON.stringify(donnees),
  });
}

// Enregistre la répartition des mannes d'une commande sur les emplacements scannés.
export function placerEmplacements(
  idCommande: string,
  lignes: { id_emplacement: string; nombre_mannes: number }[]
): Promise<void> {
  return requeteApi<void>(`/commandes/${encodeURIComponent(idCommande)}/emplacements`, {
    method: 'POST',
    body: JSON.stringify({ emplacements: lignes }),
  });
}

// Liste les commandes du pipeline actif (avec nom du client) pour le tableau.
export function listerCommandes(): Promise<CommandeCarte[]> {
  return requeteApi<CommandeCarte[]>('/commandes');
}

// Modifie les scalaires d'une commande « à faire » (flags + nombre de mannes).
export function modifierCommande(
  id: string,
  donnees: {
    nombre_mannes: number;
    prioritaire?: boolean;
    cintres_client?: boolean;
    cintres_entr_rendus?: boolean;
  }
): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(donnees),
  });
}

// Enregistre le nombre de cintres entreprise utilisés (pendant le repassage, commande en cours).
export function definirCintresEntreprise(id: string, nb: number): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(id)}/cintres-entreprise`, {
    method: 'PUT',
    body: JSON.stringify({ cintres_entr_nb: nb }),
  });
}

// Démarre le repassage d'une commande désignée (« à faire » → « en cours »).
export function demarrerRepassage(idCommande: string): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(idCommande)}/demarrer`, {
    method: 'POST',
  });
}

// Met en pause le timer d'une commande « en cours ».
export function mettreEnPause(id: string): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(id)}/pause`, { method: 'POST' });
}

// Reprend le timer d'une commande « en cours » mise en pause.
export function reprendreRepassage(id: string): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(id)}/reprendre`, { method: 'POST' });
}

// Résout un scan client : toutes les commandes candidates, chacune avec son action.
export function resoudreScan(codeBarre: string): Promise<{ commandes: CommandeAScanner[] }> {
  return requeteApi(`/commandes/a-scanner/${encodeURIComponent(codeBarre)}`);
}

// Enregistre la remise du linge au client : « fait » → « récupéré ».
export function marquerRecuperee(id: string): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(id)}/recuperer`, { method: 'POST' });
}

// Clôture un repassage : « fait » + emplacements + SMS, en une seule transaction côté serveur.
export function cloturerRepassage(
  id: string,
  lignes: { id_emplacement: string; nombre_mannes: number }[]
): Promise<Commande> {
  return requeteApi<Commande>(`/commandes/${encodeURIComponent(id)}/cloturer`, {
    method: 'POST',
    body: JSON.stringify({ emplacements: lignes }),
  });
}
