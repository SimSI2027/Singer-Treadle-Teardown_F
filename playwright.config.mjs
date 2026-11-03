// Playwright configuration for the exhibit suite: Chromium only, with the kit's GPU flags (paths.mjs).
import {CHROMIUM_ARGS, CHROMIUM} from './paths.mjs';

export default {
  testDir: 'tests',
  testMatch: /.*\.spec\.mjs/,
  timeout: 120000,
  expect: {timeout: 15000},
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: {width: 1600, height: 900},
    launchOptions: {args: CHROMIUM_ARGS, executablePath: CHROMIUM},
    video: 'off',
    screenshot: 'off',
    trace: 'off',
  },
};
