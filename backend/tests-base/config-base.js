require('dotenv').config();

// Le nom peut être surchargé pour une autre base de test, mais jamais vers une base qui ne
// s'annonce pas comme telle. La surcharge passe par DB_NAME_TEST et non par DB_NAME : ainsi
// la valeur de production présente dans le .env est écrasée d'office, et le seul levier
// disponible porte un nom qui dit qu'il désigne une base de test.
process.env.DB_NAME = process.env.DB_NAME_TEST || 'manne_bulles_test';

if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(
    `Refus : les tests en base n'acceptent qu'une base finissant par _test ` +
      `(reçu : ${process.env.DB_NAME}). Aucune connexion n'a été tentée.`
  );
}

const configBase = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

module.exports = { configBase };
