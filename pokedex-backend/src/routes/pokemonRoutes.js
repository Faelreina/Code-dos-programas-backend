const express = require('express');
const pokemonController = require('../controllers/pokemonController');

const router = express.Router();

router.get('/favorites', pokemonController.getFavorites);
router.post('/favorites', pokemonController.addFavorite);
router.delete('/favorites/:id', pokemonController.removeFavorite);

router.get('/', pokemonController.listPokemons);
router.get('/:name', pokemonController.getPokemonByName);

module.exports = router;