const axios = require('axios');
const config = require('../config');
const { NotFoundError, ExternalApiError } = require('../utils/errors');

const api = axios.create({
  baseURL: config.pokeApiBaseUrl,
  timeout: 10000,
});

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

function extractIdFromUrl(url) {
  const segments = url.split('/').filter(Boolean);
  return Number(segments[segments.length - 1]);
}

function officialArtworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function translateAxiosError(error, context) {
  if (error.response && error.response.status === 404) {
    return new NotFoundError(`${context} não encontrado(a) na PokéAPI.`);
  }
  return new ExternalApiError(`Não foi possível obter dados da PokéAPI (${context}).`);
}

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
      heightM: data.height / 10,
      weightKg: data.weight / 10,
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
