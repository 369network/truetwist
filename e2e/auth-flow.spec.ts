import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('landing page loads and shows sign-up CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TrueTwist/i);
    const signUpBtn = page.getByRole('link', { name: /sign up|get started/i });
    await expect(signUpBtn).toBeVisible();
  });

  test('sign-up form validates required fields', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('button', { name: /create|sign up|register/i }).click();
    // Expect validation errors
    await expect(page.getByText(/required|email|password/i)).toBeVisible();
  });

  test('login page loads with form fields', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Protected Routes', () => {
  test('dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/auth|login|sign/i);
    expect(page.url()).toMatch(/auth|login|sign/i);
  });

  test('settings page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/auth|login|sign/i);
    expect(page.url()).toMatch(/auth|login|sign/i);
  });
});
