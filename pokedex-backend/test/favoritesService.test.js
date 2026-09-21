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