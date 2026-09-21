const fs = require('fs');
const path = require('path');
const config = require('../config');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const DB_PATH = config.favoritesDbPath;

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