# Back-end — PokéDex API (Node.js + Express)

## `package.json`

```json
{
  "name": "pokedex-backend",
  "version": "1.0.0",
  "description": "API REST da PokéDex - consome a PokéAPI e gerencia uma lista de favoritos persistida em arquivo JSON.",
  "main": "src/server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "node --test test/*.test.js"
  },
  "keywords": ["pokedex", "express", "pokeapi"],
  "license": "MIT",
  "dependencies": {
    "axios": "^1.7.9",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  }
}
```

## `.env.example`

```bash
# Porta em que a API vai rodar
PORT=3001

# URL base da PokéAPI (útil caso queira apontar para um mirror/proxy)
POKEAPI_BASE_URL=https://pokeapi.co/api/v2

# Quantos Pokémon listar (1ª geração = 151)
POKEMON_LIMIT=151

# Onde os favoritos são persistidos (arquivo JSON)
FAVORITES_DB_PATH=./data/favorites.json

# Tempo de cache em memória para respostas da PokéAPI (ms). 1h = 3600000
CACHE_TTL_MS=3600000

# Origem permitida para CORS (URL do front-end em desenvolvimento)
CORS_ORIGIN=http://localhost:5173
```

## `.gitignore`

```bash
node_modules/
.env
data/favorites.json
npm-debug.log*
```

## `src/config/index.js`

```js
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
```

## `src/utils/errors.js`

```js
/**
 * Erro base da aplicação. Toda vez que um service/controller precisar
 * interromper o fluxo com um status HTTP específico, deve lançar uma
 * instância desta classe (ou de uma subclasse) em vez de um Error genérico.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(message, 404);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Requisição inválida.') {
    super(message, 400);
  }
}

class ExternalApiError extends AppError {
  constructor(message = 'Falha ao se comunicar com a PokéAPI.') {
    super(message, 502);
  }
}

module.exports = { AppError, NotFoundError, BadRequestError, ExternalApiError };
```

## `src/services/pokeApiService.js`

```js
const axios = require('axios');
const config = require('../config');
const { NotFoundError, ExternalApiError } = require('../utils/errors');

const api = axios.create({
  baseURL: config.pokeApiBaseUrl,
  timeout: 10000,
});

// Cache simples em memória (chave -> { value, expiresAt }).
// Evita bater na PokéAPI a cada requisição enquanto o servidor estiver de pé.
const cache = new Map();

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setInCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + config.cacheTtlMs });
}

/**
 * Extrai o id numérico do Pokémon a partir da URL retornada pela PokéAPI.
 * Ex: "https://pokeapi.co/api/v2/pokemon/25/" -> 25
 */
function extractIdFromUrl(url) {
  const segments = url.split('/').filter(Boolean);
  return Number(segments[segments.length - 1]);
}

/**
 * Monta a URL da artwork oficial diretamente pelo id, sem precisar buscar
 * os detalhes completos de cada Pokémon (o endpoint de listagem da PokéAPI
 * só devolve nome + url, então construímos a imagem "na mão").
 */
function officialArtworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function translateAxiosError(error, context) {
  if (error.response && error.response.status === 404) {
    return new NotFoundError(`${context} não encontrado(a) na PokéAPI.`);
  }
  return new ExternalApiError(`Não foi possível obter dados da PokéAPI (${context}).`);
}

/**
 * Lista os primeiros N Pokémon (nome + id + imagem), na ordem da Pokédex.
 */
async function listPokemons(limit = config.pokemonLimit) {
  const cacheKey = `list:${limit}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await api.get('/pokemon', { params: { limit, offset: 0 } });
    const pokemons = data.results.map((item) => {
      const id = extractIdFromUrl(item.url);
      return { id, name: item.name, image: officialArtworkUrl(id) };
    });
    setInCache(cacheKey, pokemons);
    return pokemons;
  } catch (error) {
    throw translateAxiosError(error, 'Lista de Pokémon');
  }
}

/**
 * Busca detalhes completos de um Pokémon por nome (ou id).
 */
async function getPokemonDetails(nameOrId) {
  const key = String(nameOrId).toLowerCase().trim();
  const cacheKey = `details:${key}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await api.get(`/pokemon/${encodeURIComponent(key)}`);

    const image =
      data.sprites?.other?.['official-artwork']?.front_default ||
      data.sprites?.front_default ||
      officialArtworkUrl(data.id);

    const details = {
      id: data.id,
      name: data.name,
      image,
      heightM: data.height / 10, // a PokéAPI retorna altura em decímetros
      weightKg: data.weight / 10, // e peso em hectogramas
      types: data.types
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.type.name),
      abilities: data.abilities.map((a) => ({
        name: a.ability.name,
        isHidden: a.is_hidden,
      })),
    };

    setInCache(cacheKey, details);
    return details;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ExternalApiError) throw error;
    throw translateAxiosError(error, `Pokémon "${nameOrId}"`);
  }
}

module.exports = { listPokemons, getPokemonDetails };
```

## `src/services/favoritesService.js`

```js
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const DB_PATH = config.favoritesDbPath;

/** Garante que a pasta e o arquivo do "banco" existam antes de ler/escrever. */
function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
  }
}

function readAll() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    // Arquivo corrompido/vazio: recomeça do zero em vez de derrubar o servidor.
    return [];
  }
}

function writeAll(favorites) {
  ensureDbFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(favorites, null, 2));
}

function getAll() {
  return readAll();
}

/**
 * Adiciona um Pokémon aos favoritos.
 * @param {{id: number, name: string, image?: string}} pokemon
 */
function add(pokemon) {
  if (!pokemon || pokemon.id === undefined || !pokemon.name) {
    throw new BadRequestError('Informe ao menos "id" e "name" do Pokémon a favoritar.');
  }

  const favorites = readAll();
  const alreadyExists = favorites.some((f) => Number(f.id) === Number(pokemon.id));
  if (alreadyExists) {
    return favorites.find((f) => Number(f.id) === Number(pokemon.id));
  }

  const favorite = {
    id: Number(pokemon.id),
    name: pokemon.name,
    image: pokemon.image || null,
    favoritedAt: new Date().toISOString(),
  };

  favorites.push(favorite);
  writeAll(favorites);
  return favorite;
}

/**
 * Remove um favorito pelo id do Pokémon.
 */
function remove(id) {
  const favorites = readAll();
  const index = favorites.findIndex((f) => Number(f.id) === Number(id));
  if (index === -1) {
    throw new NotFoundError(`Pokémon com id ${id} não está na lista de favoritos.`);
  }
  const [removed] = favorites.splice(index, 1);
  writeAll(favorites);
  return removed;
}

module.exports = { getAll, add, remove };
```

## `src/controllers/pokemonController.js`

```js
const pokeApiService = require('../services/pokeApiService');
const favoritesService = require('../services/favoritesService');

/** GET /api/pokemons */
async function listPokemons(req, res, next) {
  try {
    const pokemons = await pokeApiService.listPokemons();
    res.json(pokemons);
  } catch (error) {
    next(error);
  }
}

/** GET /api/pokemons/:name */
async function getPokemonByName(req, res, next) {
  try {
    const details = await pokeApiService.getPokemonDetails(req.params.name);
    res.json(details);
  } catch (error) {
    next(error);
  }
}

/** GET /api/pokemons/favorites */
async function getFavorites(req, res, next) {
  try {
    const favorites = favoritesService.getAll();
    res.json(favorites);
  } catch (error) {
    next(error);
  }
}

/** POST /api/pokemons/favorites */
async function addFavorite(req, res, next) {
  try {
    const favorite = favoritesService.add(req.body);
    res.status(201).json(favorite);
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/pokemons/favorites/:id */
async function removeFavorite(req, res, next) {
  try {
    const removed = favoritesService.remove(req.params.id);
    res.json(removed);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPokemons,
  getPokemonByName,
  getFavorites,
  addFavorite,
  removeFavorite,
};
```

## `src/routes/pokemonRoutes.js`

```js
const express = require('express');
const pokemonController = require('../controllers/pokemonController');

const router = express.Router();

// IMPORTANTE: as rotas de /favorites precisam vir ANTES de /:name.
// Caso contrário, uma requisição para "/favorites" seria interpretada
// pelo Express como "/:name" com name = "favorites".
router.get('/favorites', pokemonController.getFavorites);
router.post('/favorites', pokemonController.addFavorite);
router.delete('/favorites/:id', pokemonController.removeFavorite);

router.get('/', pokemonController.listPokemons);
router.get('/:name', pokemonController.getPokemonByName);

module.exports = router;
```

## `src/middleware/errorHandler.js`

```js
const { AppError } = require('../utils/errors');

/**
 * Middleware de erro centralizado. Qualquer `next(error)` chamado nas rotas
 * cai aqui. Erros conhecidos (AppError) viram uma resposta JSON amigável
 * com o status code correto; erros inesperados viram 500 genérico.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('Erro inesperado:', err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Rota ${req.method} ${req.originalUrl} não existe.` });
}

module.exports = { errorHandler, notFoundHandler };
```

## `src/app.js`

```js
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
```

## `src/server.js`

```js
const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`🚀 PokéDex API rodando em http://localhost:${config.port}`);
  console.log(`   Consultando a PokéAPI em: ${config.pokeApiBaseUrl}`);
});
```

## `test/favoritesService.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Usa um arquivo de banco isolado só para os testes, para não sujar
// (nem depender de) o data/favorites.json usado em desenvolvimento.
const TEST_DB_PATH = path.join(__dirname, 'tmp.favorites.test.json');
process.env.FAVORITES_DB_PATH = TEST_DB_PATH;

// Reimporta o config/service depois de setar a env var acima.
delete require.cache[require.resolve('../src/config')];
delete require.cache[require.resolve('../src/services/favoritesService')];
const favoritesService = require('../src/services/favoritesService');

function cleanup() {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
}

test.beforeEach(cleanup);
test.after(cleanup);

test('getAll retorna lista vazia quando não há favoritos', () => {
  const favorites = favoritesService.getAll();
  assert.deepEqual(favorites, []);
});

test('add insere um novo favorito e retorna os dados salvos', () => {
  const favorite = favoritesService.add({ id: 25, name: 'pikachu', image: 'url-da-imagem' });
  assert.equal(favorite.id, 25);
  assert.equal(favorite.name, 'pikachu');
  assert.ok(favorite.favoritedAt);

  const all = favoritesService.getAll();
  assert.equal(all.length, 1);
});

test('add não duplica um Pokémon já favoritado', () => {
  favoritesService.add({ id: 1, name: 'bulbasaur' });
  favoritesService.add({ id: 1, name: 'bulbasaur' });

  const all = favoritesService.getAll();
  assert.equal(all.length, 1);
});

test('add lança erro se faltar id ou name', () => {
  assert.throws(() => favoritesService.add({ name: 'sem-id' }));
  assert.throws(() => favoritesService.add({ id: 4 }));
});

test('remove exclui um favorito existente', () => {
  favoritesService.add({ id: 4, name: 'charmander' });
  const removed = favoritesService.remove(4);
  assert.equal(removed.id, 4);
  assert.equal(favoritesService.getAll().length, 0);
});

test('remove lança 404 ao tentar remover Pokémon inexistente', () => {
  assert.throws(() => favoritesService.remove(999), /não está na lista de favoritos/);
});
```