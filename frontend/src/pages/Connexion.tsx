import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { requeteApi, ErreurApi } from '../api/client';
import type { Utilisateur } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ListeNoms } from '../composants/ListeNoms';
import { PavePin } from '../composants/PavePin';
import logo from '../assets/logo.png';

// Écran de connexion : choix de l'utilisatrice puis saisie du code PIN.
export function Connexion() {
  // function connexion = "ouvre la session et enregistre le jeton"
  const { connexion } = useAuth();
  // function navigate = "redirige une fois la connexion réussie"
  const navigate = useNavigate();
  // Utilisateur|null selectionnee = "utilisatrice choisie, null tant qu'aucune ne l'est"
  const [selectionnee, setSelectionnee] = useState<Utilisateur | null>(null);
  // string|null erreur = "message affiché sous le pavé"
  const [erreur, setErreur] = useState<string | null>(null);

  // Utilisateur[] utilisatrices = "noms proposés au choix"
  const { data: utilisatrices = [] } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => requeteApi<Utilisateur[]>('/utilisateurs'),
  });

  // Tente la connexion avec le PIN saisi.
  // string pin = "code à quatre chiffres"
  async function soumettrePin(pin: string) {
    if (!selectionnee) return;
    setErreur(null);
    try {
      await connexion(selectionnee.id_utilisateur, pin);
      navigate('/');
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 429) {
        // number secondes = "délai avant nouvelle tentative, donné par le 429"
        const secondes = (e.corps as { retryAfter?: number })?.retryAfter ?? 60;
        setErreur(`Trop de tentatives. Réessayez dans ${secondes} s.`);
      } else {
        setErreur('Identifiants invalides.');
      }
    }
  }

  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-6 p-4">
      <h1>
        <img src={logo} alt="La Manne à Bulles" className="w-84 max-w-full" />
      </h1>
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
