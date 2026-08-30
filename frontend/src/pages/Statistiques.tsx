import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chargerStatistiques } from '../api/statistiques';
import { formaterHMS } from '../composants/Chrono';

// Format AAAA-MM-JJ construit à la main, et NON via toISOString() : cette dernière convertit en
// UTC et décalerait la date d'un jour pour un fuseau en avance sur Greenwich.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Premier et dernier jour du mois courant.
function moisCourant() {
  const n = new Date();
  return {
    debut: iso(new Date(n.getFullYear(), n.getMonth(), 1)),
    fin: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)),
  };
}

// Statistiques de temps de repassage sur une période. Écran de la gérante (#300).
export function Statistiques() {
  const [periode, setPeriode] = useState(moisCourant());
  const { data } = useQuery({
    queryKey: ['statistiques', periode.debut, periode.fin],
    queryFn: () => chargerStatistiques(periode.debut, periode.fin),
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold">Statistiques de repassage</h1>

      <div className="flex gap-3">
        <label className="flex flex-col text-sm">
          Du
          <input type="date" value={periode.debut} className="rounded border p-1"
            onChange={(e) => setPeriode({ ...periode, debut: e.target.value })} />
        </label>
        <label className="flex flex-col text-sm">
          Au
          <input type="date" value={periode.fin} className="rounded border p-1"
            onChange={(e) => setPeriode({ ...periode, fin: e.target.value })} />
        </label>
      </div>

      {!data && <p>Chargement…</p>}

      {data && data.global.nbCommandes === 0 && <p>Aucune commande terminée sur cette période.</p>}

      {data && data.global.nbCommandes > 0 && (
        <>
          <section className="rounded border p-3">
            <h2 className="font-semibold">Ensemble de la période</h2>
            <p>{data.global.nbCommandes} commande(s) · {data.global.totalMannes} manne(s)</p>
            <p>Temps total : {formaterHMS(data.global.tempsTotalS)}</p>
            <p>Moyenne par commande : {formaterHMS(data.global.moyenneParCommandeS)}</p>
            <p>Moyenne par manne : {formaterHMS(data.global.moyenneParManneS)}</p>
          </section>

          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Repasseuse</th><th>Commandes</th><th>Mannes</th><th>Temps total</th><th>Par manne</th>
              </tr>
            </thead>
            <tbody>
              {data.parRepasseuse.map((l) => (
                <tr key={l.id_utilisateur ?? 'non-attribue'}>
                  <td>{l.repasseuse ?? 'Non attribué'}</td>
                  <td>{l.nbCommandes}</td>
                  <td>{l.totalMannes}</td>
                  <td>{formaterHMS(l.tempsTotalS)}</td>
                  <td>{formaterHMS(l.moyenneParManneS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
