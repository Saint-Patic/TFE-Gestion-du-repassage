export type Role = 'gerante' | 'repasseuse';

export type Utilisateur = {
  id_utilisateur: string;
  nom: string;
  role: Role;
};

export type ReponseLogin = {
  jeton: string;
  utilisateur: Utilisateur;
};

export type Client = {
  id_client: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  code_barre: string;
  date_creation: string;
};

export type NouveauClient = {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
};

export type Commande = {
  id_commande: string;
  id_client: string;
  statut: 'a_faire' | 'en_cours' | 'fait' | 'recupere';
  nombre_mannes: number;
  prioritaire: boolean;
  cintres_client: boolean;
  cintres_entr_rendus: boolean;
  date_reception: string;
  id_repasseuse?: string | null;
  repassage_debut?: string | null;
  temps_repassage_s?: number;
  cintres_entr_nb?: number | null;
};

// Un emplacement occupé par une commande, avec le nombre de mannes qui s'y trouvent.
export type EmplacementCommande = { code_barre: string; nombre_mannes: number };

export type CommandeCarte = Commande & {
  client_nom: string;
  client_prenom: string;
  // Booléen calculé côté serveur : le numéro du client ne transite pas jusqu'ici.
  client_mobile?: boolean;
  // Nom de la repasseuse attitrée ; null si la commande n'en a pas.
  repasseuse_nom?: string | null;
  // Vide dès que les mannes ne sont plus sur les étagères (« en cours », « récupéré »).
  emplacements?: EmplacementCommande[];
};

// Une commande candidate au scan, avec l'action que le serveur en déduit.
export type CommandeAScanner = CommandeCarte & {
  action: 'demarrer' | 'cloturer' | 'recuperer';
};

export type Emplacement = {
  id_emplacement: string;
  code_barre: string;
  etagere: string | null;
  niveau: number | null;
  position: string | null;
  est_au_sol?: boolean;
  id_client_occupant?: string | null;
  client_nom_occupant?: string | null;
  client_prenom_occupant?: string | null;
};

export type ContenuEmplacement = {
  id_commande: string;
  nombre_mannes: number;
  statut: Commande['statut'];
  id_client: string;
  client_nom: string;
  client_prenom: string;
};

export type EvenementHistorique = {
  ancien_statut: string | null;
  nouveau_statut: string;
  horodatage: string;
  utilisateur: string;
};

export type CommandeHistorique = {
  id_commande: string;
  statut: string;
  nombre_mannes: number;
  temps_repassage_s: number;
  date_reception: string;
  date_recuperation: string | null;
  evenements: EvenementHistorique[];
};

// Nom volontairement distinct du composant `HistoriqueClient` (pages/), pour éviter
// une collision d'import dans ce composant.
export type HistoriqueDunClient = {
  client: { id_client: string; nom: string; prenom: string };
  commandes: CommandeHistorique[];
};
