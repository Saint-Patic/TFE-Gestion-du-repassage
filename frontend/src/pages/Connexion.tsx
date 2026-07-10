import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { requeteApi, ErreurApi } from '../api/client';
import type { Utilisateur } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ListeNoms } from '../composants/ListeNoms';
import { PavePin } from '../composants/PavePin';

export function Connexion() {
  const { connexion } = useAuth();
  const navigate = useNavigate();
  const [selectionnee, setSelectionnee] = useState<Utilisateur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: utilisatrices = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => requeteApi<Utilisateur[]>('/utilisateurs'),
  });

  async function soumettrePin(pin: string) {
    if (!selectionnee) return;
    setErreur(null);
    try {
      await connexion(selectionnee.id_utilisateur, pin);
      navigate('/');
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 429) {
        const secondes = (e.corps as { retryAfter?: number })?.retryAfter ?? 60;
        setErreur(`Trop de tentatives. Réessayez dans ${secondes} s.`);
      } else {
        setErreur('Identifiants invalides.');
      }
    }
  }

  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-6 p-4">
      <h1 className="text-2xl font-bold">La Manne à Bulles</h1>
      {!selectionnee ? (
        <ListeNoms utilisatrices={utilisatrices} onSelection={setSelectionnee} />
      ) : (
        <>
          <p className="text-lg">Bonjour {selectionnee.nom}, entrez votre code PIN</p>
          <PavePin onComplet={soumettrePin} />
          {erreur && <p className="text-red-600">{erreur}</p>}
          <button
            className="text-sm text-gray-500 underline"
            onClick={() => {
              setSelectionnee(null);
              setErreur(null);
            }}
          >
            Changer d'utilisatrice
          </button>
        </>
      )}
    </div>
  );
}
