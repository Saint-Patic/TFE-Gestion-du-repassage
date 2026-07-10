require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateEtiquette } = require('./etiquette');
const { envoyer } = require('./sortie');

// Fabrique : construit l'app Express de l'agent (sans listen, pour la testabilité).
function creerAgent() {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: process.env.ORIGINE_CORS || 'http://localhost:5173' }));

  app.get('/sante', (req, res) => {
    res.json({ statut: 'ok' });
  });

  app.post('/imprimer', async (req, res) => {
    const { nom, prenom, code_barre } = req.body || {};
    if (!nom || !prenom || !code_barre) {
      return res.status(400).json({ message: 'nom, prenom et code_barre sont requis.' });
    }
    try {
      const pdf = await generateEtiquette({ nom, prenom, code_barre });
      const resultat = await envoyer(pdf, `etiquette-${code_barre}`);
      return res.json({ ok: true, ...resultat });
    } catch (err) {
      return res.status(500).json({ message: "Erreur lors de l'impression." });
    }
  });

  return app;
}

module.exports = creerAgent;

// Démarrage direct (hors test).
if (require.main === module) {
  const port = process.env.PORT_AGENT || 4000;
  creerAgent().listen(port, () => {
    console.log(`Agent d'impression démarré sur http://localhost:${port}`);
  });
}
