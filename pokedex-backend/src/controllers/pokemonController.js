const pokeApiService = require('../services/pokeApiService');
const favoritesService = require('../services/favoritesService');

async function listPokemons(req, res, next) {
  try {
    const pokemons = await pokeApiService.listPokemons();
    res.json(pokemons);
  } catch (error) {
    next(error);
  }
}

async function getPokemonByName(req, res, next) {
  try {
    const details = await pokeApiService.getPokemonDetails(req.params.name);
    res.json(details);
  } catch (error) {
    next(error);
  }
}

async function getFavorites(req, res, next) {
  try {
    const favorites = favoritesService.getAll();
    res.json(favorites);
  } catch (error) {
    next(error);
  }
}

async function addFavorite(req, res, next) {
  try {
    const favorite = favoritesService.add(req.body);
    res.status(201).json(favorite);
  } catch (error) {
    next(error);
  }
}

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