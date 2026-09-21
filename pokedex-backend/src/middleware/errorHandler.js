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