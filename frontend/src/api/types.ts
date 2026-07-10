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
