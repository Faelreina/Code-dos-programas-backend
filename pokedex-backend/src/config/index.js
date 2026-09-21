require('dotenv').config();
const path = require('path');

module.exports = {
  port: Number(process.env.PORT) || 3001,
  pokeApiBaseUrl: process.env.POKEAPI_BASE_URL || 'https://pokeapi.co/api/v2',
  pokemonLimit: Number(process.env.POKEMON_LIMIT) || 151,
  favoritesDbPath: path.resolve(
    __dirname,
    '..',
    '..',
    process.env.FAVORITES_DB_PATH || './data/favorites.json'
  ),
  cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 3600000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};