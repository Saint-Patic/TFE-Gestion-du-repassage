import { Routes, Route } from 'react-router-dom';
import { Connexion } from './pages/Connexion';
import { Accueil } from './pages/Accueil';
import { NouveauClient } from './pages/NouveauClient';
import { Clients } from './pages/Clients';
import { RouteProtegee } from './composants/RouteProtegee';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/" element={<RouteProtegee><Accueil /></RouteProtegee>} />
      <Route path="/clients/nouveau" element={<RouteProtegee><NouveauClient /></RouteProtegee>} />
      <Route path="/clients" element={<RouteProtegee><Clients /></RouteProtegee>} />
    </Routes>
  );
}
