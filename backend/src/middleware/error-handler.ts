import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[error] ${err.message}`, err instanceof ApiError ? err.details : '');

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
}
