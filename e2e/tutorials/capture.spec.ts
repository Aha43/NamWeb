// Tutorial screenshot harness (see docs/features/tutorial-sync/design.md).
//
// Not a test gate — it *produces assets*. It drives the curated demo workspace (buildDemo()) through
// the real authed app (Supabase mocked, so no backend) and writes one PNG per catalog slide to
// `tutorials/output/<id>/<viewport>/NN-<shot>.png`. The slideshow assembler (tutorials/build-slideshow.ts)
// then pairs each PNG with its caption from the catalog.
//
// Run via `npm run tutorials:capture` (the `tutorials-desktop` + `tutorials-phone` Playwright
// projects). It is deliberately excluded from `npm run e2e:mocked` — assets, not assertions.

import { type Page } from '@playwright/test';
import { test, expect } from '../mockedTest';
import { buildDemo } from '../../src/domain/buildDemo';
import { tutorials, type Tutorial, type Viewport } from '../../src/tutorials/catalog';

// A deterministic id generator + a real `now` so the demo's "due today / this week / overdue"
// groupings line up with the day the screenshots are taken (good for fresh-looking marketing shots).
let idCounter = 0;
const newId = (): string => `demo-${idCounter++}`;
test.use({ seedDoc: buildDemo(newId, new Date()) });

/** Which viewport this project captures, derived from the Playwright project name. */
function currentViewport(projectName: string): Viewport {
  return projectName.includes('phone') ? 'phone' : 'desktop';
}

/** A slug → relative output path under the repo root (Playwright's cwd). */
function shotPath(id: string, viewport: Viewport, index: number, shot: string): string {
  const nn = String(index + 1).padStart(2, '0');
  return `tutorials/output/${id}/${viewport}/${nn}-${shot}.png`;
}

/** The choreography that walks the app to each slide and calls `shoot(slug)` to capture it. */
type Shoot = (slug: string) => Promise<void>;
type Choreography = (page: Page, shoot: Shoot) => Promise<void>;

const choreographies: Record<string, Choreography> = {
  'process-inbox': async (page, shoot) => {
    // A clear, emoji-free capture from the demo seed (see src/domain/buildDemo.ts).
    const capture = 'Email Sara about the long weekend';

    await page.goto('/inbox');
    await expect(page.getByText(capture)).toBeVisible(); // inbox painted with the demo seed
    await shoot('inbox-overview');

    await page.getByRole('button', { name: `Process ${capture}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await shoot('process-open');

    await dialog.getByRole('button', { name: /one action/i }).click();
    await shoot('clarify-action');

    // Send it to Next, then wait for the optimistic change to be pushed to the (mocked) backend
    // so a fresh pull of /next shows it — keeps the last slide viewport-agnostic (no sidebar click).
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/rest/v1/workspaces') && r.request().method() === 'PATCH',
      ),
      dialog.getByRole('button', { name: /do it next/i }).click(),
    ]);
    await expect(dialog).toBeHidden();

    await page.goto('/next');
    await expect(page.getByText(capture)).toBeVisible();
    await shoot('landed-in-next');
  },
};

for (const tutorial of tutorials) {
  test(`capture: ${tutorial.id}`, async ({ page }, testInfo) => {
    const viewport = currentViewport(testInfo.project.name);
    test.skip(!tutorial.viewports.includes(viewport), `${tutorial.id} skips ${viewport}`);

    const choreography = choreographies[tutorial.id];
    expect(choreography, `no choreography for tutorial "${tutorial.id}"`).toBeTruthy();

    const taken: string[] = [];
    const shoot: Shoot = async (slug) => {
      const slide = tutorial.slides.find((s) => s.shot === slug);
      expect(slide, `shot "${slug}" is not a slide of "${tutorial.id}"`).toBeTruthy();
      const index = tutorial.slides.indexOf(slide as Tutorial['slides'][number]);
      await page.screenshot({ path: shotPath(tutorial.id, viewport, index, slug) });
      taken.push(slug);
    };

    await choreography(page, shoot);

    // The choreography and the catalog must stay in lock-step, in order — else the slideshow has
    // a caption with no image (or vice versa).
    expect(taken).toEqual(tutorial.slides.map((s) => s.shot));
  });
}
