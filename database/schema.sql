-- ============================================================
-- La Manne à Bulles - Schéma de base de données PostgreSQL
-- Correspond au modèle entité-association validé (figure ERD)
-- ============================================================

-- Extension nécessaire pour générer des UUID (identifiants non séquentiels,
-- voir section Stratégie de sécurité et RGPD)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table : Utilisateur
-- Gérante et repasseuses, authentifiées par code PIN individuel
-- ============================================================
CREATE TABLE utilisateur (
    id_utilisateur   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom              VARCHAR(100) NOT NULL,
    role             VARCHAR(20) NOT NULL CHECK (role IN ('gerante', 'repasseuse')),
    code_pin_hache   VARCHAR(255) NOT NULL
);

-- ============================================================
-- Table : Client
-- ============================================================
CREATE TABLE client (
    id_client        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom              VARCHAR(100) NOT NULL,
    prenom           VARCHAR(100) NOT NULL,
    telephone        VARCHAR(20) NOT NULL,
    email            VARCHAR(255),
    code_barre       VARCHAR(50) NOT NULL UNIQUE,
    date_creation    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Table : Emplacement
-- Étagères A, B, C, D (4 niveaux × 3 positions) et E, la petite (3 niveaux × 2 positions)
-- ============================================================
-- Le sol (est_au_sol = TRUE) est un débordement partagé sans étagère/niveau/position :
-- ces trois colonnes sont donc nullables et les CHECK tolèrent le sol.
-- Contraintes nommées explicitement : c'est ce que produit la migration du #190
-- (scripts/ajouter-au-sol.js), donc une base neuve et une base migrée portent les
-- mêmes noms. Sans ces noms, PostgreSQL générerait emplacement_check, _check1, _check2
-- — numérotation dépendante de l'ordre de création, sur laquelle aucune migration
-- ne doit reposer.
CREATE TABLE emplacement (
    id_emplacement   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_barre       VARCHAR(50) NOT NULL UNIQUE,
    est_au_sol       BOOLEAN NOT NULL DEFAULT FALSE,
    etagere          CHAR(1)     CONSTRAINT emplacement_etagere_check  CHECK (est_au_sol OR etagere IN ('A','B','C','D','E')),
    niveau           SMALLINT    CONSTRAINT emplacement_niveau_check   CHECK (est_au_sol OR niveau BETWEEN 1 AND 4),
    position         VARCHAR(10) CONSTRAINT emplacement_position_check CHECK (est_au_sol OR position IN ('gauche','centre','droite')),
    UNIQUE (etagere, niveau, position)
);

-- ============================================================
-- Table : Commande
-- ============================================================
CREATE TABLE commande (
    id_commande         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nullable : supprimer un client DÉTACHE ses commandes (id_client → NULL) au lieu de les
    -- supprimer, ce qui préserve les statistiques (#300). Pas de ON DELETE ici : le détachement
    -- doit être explicite dans la transaction de suppression, jamais implicite.
    id_client           UUID REFERENCES client(id_client),
    statut              VARCHAR(20) NOT NULL DEFAULT 'a_faire'
                            CHECK (statut IN ('a_faire','en_cours','fait','recupere')),
    prioritaire         BOOLEAN NOT NULL DEFAULT FALSE,
    cintres_client      BOOLEAN NOT NULL DEFAULT FALSE,
    cintres_entr_rendus BOOLEAN NOT NULL DEFAULT FALSE,  -- client a rendu des cintres entreprise
    cintres_entr_nb     SMALLINT,
    nombre_mannes       SMALLINT NOT NULL DEFAULT 0,
    temps_repassage_s   INTEGER NOT NULL DEFAULT 0,  -- secondes écoulées, hors pauses
    date_reception      TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_recuperation   TIMESTAMPTZ,
    id_repasseuse       UUID REFERENCES utilisateur(id_utilisateur),  -- encodeuse (attribution)
    repassage_debut     TIMESTAMPTZ  -- heure de démarrage du repassage en cours (NULL sinon)
);

-- ============================================================
-- Table d'association : CommandeEmplacement
-- Une commande peut occuper plusieurs emplacements,
-- chacun avec son propre nombre de mannes (empilement)
-- ============================================================
CREATE TABLE commande_emplacement (
    id_commande      UUID NOT NULL REFERENCES commande(id_commande) ON DELETE CASCADE,
    id_emplacement   UUID NOT NULL REFERENCES emplacement(id_emplacement),
    nombre_mannes    SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (id_commande, id_emplacement)
);

-- ============================================================
-- Table : HistoriqueStatut
-- Trace chaque changement de statut, avec l'utilisatrice responsable
-- ============================================================
CREATE TABLE historique_statut (
    id_historique    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_commande      UUID NOT NULL REFERENCES commande(id_commande) ON DELETE CASCADE,
    ancien_statut    VARCHAR(20),
    nouveau_statut   VARCHAR(20) NOT NULL,
    horodatage       TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_utilisateur   UUID NOT NULL REFERENCES utilisateur(id_utilisateur)
);

-- ============================================================
-- Table : SmsEnAttente (US #240)
-- File des SMS à envoyer. La passerelle Android vient les chercher
-- (le serveur ne peut pas joindre le téléphone, situé derrière un NAT).
-- Le numéro de téléphone n'est PAS stocké ici : il est résolu par jointure
-- vers client au moment du retrait (minimisation RGPD).
-- ============================================================
CREATE TABLE sms_en_attente (
    id_sms           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_commande      UUID NOT NULL REFERENCES commande(id_commande) ON DELETE CASCADE,
    message          TEXT NOT NULL,
    statut           VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                         CHECK (statut IN ('en_attente','envoye','echec')),
    tentatives       SMALLINT NOT NULL DEFAULT 0,
    date_creation    TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_envoi       TIMESTAMPTZ,
    derniere_erreur  TEXT
);

-- ============================================================
-- Index utiles pour les requêtes fréquentes de l'application
-- ============================================================
CREATE INDEX idx_commande_statut ON commande(statut);
CREATE INDEX idx_commande_client ON commande(id_client);
CREATE INDEX idx_historique_commande ON historique_statut(id_commande);
CREATE INDEX idx_sms_statut ON sms_en_attente(statut);