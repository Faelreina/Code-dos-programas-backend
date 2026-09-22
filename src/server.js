const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`🚀 PokéDex API rodando em http://localhost:${config.port}`);
  console.log(`   Consultando a PokéAPI em: ${config.pokeApiBaseUrl}`);
});