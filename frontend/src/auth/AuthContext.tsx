import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { requeteApi, definirFournisseurJeton } from '../api/client';
import type { ReponseLogin, Utilisateur } from '../api/types';
import {
  lireJeton, ecrireJeton, effacerJeton, lireUtilisateur, ecrireUtilisateur,
} from './stockage';

const REFRESH_MS = 30 * 60 * 1000; // 30 min

type ContexteAuth = {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connexion: (idUtilisateur: string, pin: string) => Promise<void>;
  deconnexion: () => void;
};

const AuthContext = createContext<ContexteAuth | undefined>(undefined);

// Le client API lit le jeton via ce fournisseur.
definirFournisseurJeton(() => lireJeton());

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  const deconnexion = useCallback(() => {
    effacerJeton();
    setUtilisateur(null);
  }, []);

  const connexion = useCallback(async (idUtilisateur: string, pin: string) => {
    const reponse = await requeteApi<ReponseLogin>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ id_utilisateur: idUtilisateur, pin }),
    });
    ecrireJeton(reponse.jeton);
    ecrireUtilisateur(reponse.utilisateur);
    setUtilisateur(reponse.utilisateur);
  }, []);

  // Au démarrage : valider un éventuel jeton existant.
  useEffect(() => {
    async function restaurer() {
      if (!lireJeton()) {
        setChargement(false);
        return;
      }
      try {
        await requeteApi('/auth/session');
        setUtilisateur(lireUtilisateur());
      } catch {
        deconnexion();
      } finally {
        setChargement(false);
      }
    }
    restaurer();
  }, [deconnexion]);

  // Rafraîchissement périodique tant que connecté.
  useEffect(() => {
    if (!utilisateur) return;
    const id = setInterval(async () => {
      try {
        const { jeton } = await requeteApi<{ jeton: string }>('/auth/refresh', { method: 'POST' });
        ecrireJeton(jeton);
      } catch {
        deconnexion();
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [utilisateur, deconnexion]);

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, connexion, deconnexion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): ContexteAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
