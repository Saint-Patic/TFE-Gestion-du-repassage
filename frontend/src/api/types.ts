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
  date_reception: string;
};
