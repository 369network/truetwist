import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  createBusinessSchema,
  updateBusinessSchema,
} from '@/lib/validations';

describe('validation schemas', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        name: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'Password1',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password1',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Pass1',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const result = registerSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'any-password',
      });
      expect(result.success).toBe(true);
    });

    it('should accept simple password (no complexity req for login)', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'a',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should accept valid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should accept valid token and password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'a'.repeat(64),
        password: 'NewPass123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const result = resetPasswordSchema.safeParse({
        token: '',
        password: 'NewPass123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject weak new password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'sometoken',
        password: 'weak',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept valid password change', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPass1',
        newPassword: 'NewPass123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject weak new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'weak',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should accept valid profile update', () => {
      const result = updateProfileSchema.safeParse({
        name: 'New Name',
        avatarUrl: 'https://example.com/avatar.png',
      });
      expect(result.success).toBe(true);
    });

    it('should accept partial update (name only)', () => {
      const result = updateProfileSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('should accept null avatarUrl (clear avatar)', () => {
      const result = updateProfileSchema.safeParse({ avatarUrl: null });
      expect(result.success).toBe(true);
    });

    it('should reject invalid avatarUrl', () => {
      const result = updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' });
      expect(result.success).toBe(false);
    });
  });

  describe('createBusinessSchema', () => {
    it('should accept valid business data', () => {
      const result = createBusinessSchema.safeParse({
        name: 'My Business',
        industry: 'Tech',
        description: 'A tech business',
        website: 'https://mybiz.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createBusinessSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should accept optional colors object', () => {
      const result = createBusinessSchema.safeParse({
        name: 'My Business',
        colors: { primary: '#FF0000', secondary: '#00FF00', accent: '#0000FF' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept business with all optional fields', () => {
      const result = createBusinessSchema.safeParse({
        name: 'Full Business',
        industry: 'Finance',
        description: 'Financial services',
        website: 'https://finance.com',
        targetAudience: { age: '25-45', income: 'high' },
        brandVoice: 'professional',
        logoUrl: 'https://finance.com/logo.png',
        colors: { primary: '#000', secondary: '#FFF', accent: '#888' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid website URL', () => {
      const result = createBusinessSchema.safeParse({
        name: 'My Business',
        website: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateBusinessSchema', () => {
    it('should accept partial updates', () => {
      const result = updateBusinessSchema.safeParse({ name: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no changes)', () => {
      const result = updateBusinessSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
