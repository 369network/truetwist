import { describe, it, expect } from 'vitest';
import { AppError, errorResponse, Errors } from '@/lib/errors';

describe('errors module', () => {
  describe('AppError', () => {
    it('should create an error with correct properties', () => {
      const err = new AppError(400, 'BAD_REQUEST', 'Something went wrong', { field: 'email' });
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.message).toBe('Something went wrong');
      expect(err.details).toEqual({ field: 'email' });
      expect(err.name).toBe('AppError');
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('Errors factory', () => {
    it('should create unauthorized error (401)', () => {
      const err = Errors.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Unauthorized');
    });

    it('should create unauthorized with custom message', () => {
      const err = Errors.unauthorized('Invalid token');
      expect(err.message).toBe('Invalid token');
    });

    it('should create forbidden error (403)', () => {
      const err = Errors.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('should create notFound error (404)', () => {
      const err = Errors.notFound('User');
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('User not found');
    });

    it('should create conflict error (409)', () => {
      const err = Errors.conflict('Email already in use');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('should create validation error (422)', () => {
      const details = [{ field: 'email', message: 'Required' }];
      const err = Errors.validation(details);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual(details);
    });

    it('should create rateLimited error (429)', () => {
      const err = Errors.rateLimited();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMITED');
    });

    it('should create badRequest error (400)', () => {
      const err = Errors.badRequest('Missing field');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
    });
  });

  describe('errorResponse', () => {
    it('should format AppError correctly', () => {
      const err = Errors.notFound('User');
      const response = errorResponse(err);
      expect(response.status).toBe(404);
    });

    it('should handle unknown errors as 500', () => {
      const response = errorResponse(new Error('something unexpected'));
      expect(response.status).toBe(500);
    });

    it('should handle non-Error objects as 500', () => {
      const response = errorResponse('string error');
      expect(response.status).toBe(500);
    });
  });
});
