export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  constructor() {
    super(404, "not_found", "Recurso no encontrado");
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, "conflict", message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, "unauthorized", "Debes iniciar sesión");
  }
}
