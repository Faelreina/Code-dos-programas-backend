const express = require('express');
const cors = require('cors');
const config = require('./config');
const pokemonRoutes = require('./routes/pokemonRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/pokemons', pokemonRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

app.get('/', (req, res) => {
  res.json({ message: 'Servidor Pokédex Backend ativo!' });
});
