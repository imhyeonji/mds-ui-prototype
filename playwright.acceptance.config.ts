import { defineConfig } from '@playwright/test';

// 4-layer acceptance tests (tests/acceptance). Their protocol driver runs the asset form's own
// functions, so they need neither the UI server nor the Docker services the E2E suite starts.
export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
});
