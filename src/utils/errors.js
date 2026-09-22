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