import { Routes, Route } from 'react-router-dom';
import { Connexion } from './pages/Connexion';
import { Accueil } from './pages/Accueil';
import { NouveauClient } from './pages/NouveauClient';
import { Clients } from './pages/Clients';
import { Encodage } from './pages/Encodage';
import { Tableau } from './pages/Tableau';
import { Reorganisation } from './pages/Reorganisation';
import { RouteProtegee } from './composants/RouteProtegee';
import { RouteRole } from './composants/RouteRole';
import { HistoriqueClient } from './pages/HistoriqueClient';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/" element={<RouteProtegee><Accueil /></RouteProtegee>} />
      <Route path="/encodage" element={<RouteProtegee><Encodage /></RouteProtegee>} />
      <Route path="/tableau" element={<RouteProtegee><Tableau /></RouteProtegee>} />
      <Route path="/reorganisation" element={<RouteProtegee><RouteRole roles={['repasseuse']}><Reorganisation /></RouteRole></RouteProtegee>} />
      <Route path="/clients/nouveau" element={<RouteProtegee><RouteRole roles={['gerante']}><NouveauClient /></RouteRole></RouteProtegee>} />
      <Route path="/clients" element={<RouteProtegee><RouteRole roles={['gerante']}><Clients /></RouteRole></RouteProtegee>} />
      <Route path="/clients/:id/historique" element={<RouteProtegee><RouteRole roles={['gerante']}><HistoriqueClient /></RouteRole></RouteProtegee>} />
    </Routes>
  );
}
