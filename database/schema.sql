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
-- Étagères A, B, C, D (3 positions/niveau) et E (2 positions/niveau)
-- ============================================================
CREATE TABLE emplacement (
    id_emplacement   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_barre       VARCHAR(50) NOT NULL UNIQUE,
    etagere          CHAR(1) NOT NULL CHECK (etagere IN ('A','B','C','D','E')),
    niveau           SMALLINT NOT NULL CHECK (niveau BETWEEN 1 AND 3),
    position         VARCHAR(10) NOT NULL CHECK (position IN ('gauche','centre','droite')),
    UNIQUE (etagere, niveau, position)
);

-- ============================================================
-- Table : Commande
-- ============================================================
CREATE TABLE commande (
    id_commande         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_client           UUID NOT NULL REFERENCES client(id_client),
    statut              VARCHAR(20) NOT NULL DEFAULT 'a_faire'
                            CHECK (statut IN ('a_faire','en_cours','fait','recupere')),
    prioritaire         BOOLEAN NOT NULL DEFAULT FALSE,
    cintres_client      BOOLEAN NOT NULL DEFAULT FALSE,
    cintres_entr_nb     SMALLINT,
    nombre_mannes       SMALLINT NOT NULL DEFAULT 0,
    temps_repassage_s   INTEGER NOT NULL DEFAULT 0,  -- secondes écoulées, hors pauses
    date_reception      TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_recuperation   TIMESTAMPTZ
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
-- Index utiles pour les requêtes fréquentes de l'application
-- ============================================================
CREATE INDEX idx_commande_statut ON commande(statut);
CREATE INDEX idx_commande_client ON commande(id_client);
CREATE INDEX idx_historique_commande ON historique_statut(id_commande);