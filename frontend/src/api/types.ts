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
};

export type CommandeCarte = Commande & {
  client_nom: string;
  client_prenom: string;
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
