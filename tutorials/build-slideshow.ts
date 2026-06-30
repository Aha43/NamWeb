// Slideshow assembler for the tutorial-sync routine (see docs/features/tutorial-sync/design.md).
//
// Pairs each catalog slide's caption with the screenshot the capture harness produced and writes a
// `tutorials/output/<id>/slideshow.md` per tutorial — a plain-Markdown deck NamProduct can render or
// embed. Run after the capture step (`npm run tutorials:build` does both). Node script, run via tsx.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tutorials } from '../src/tutorials/catalog';

const OUT = 'tutorials/output';

for (const tutorial of tutorials) {
  const lines: string[] = [`# ${tutorial.title}`, ''];

  for (const viewport of tutorial.viewports) {
    lines.push(`## ${viewport}`, '');
    tutorial.slides.forEach((slide, index) => {
      const file = `${String(index + 1).padStart(2, '0')}-${slide.shot}.png`;
      const rel = `${viewport}/${file}`;
      const present = existsSync(join(OUT, tutorial.id, viewport, file));
      lines.push(`### ${index + 1}. ${slide.caption}`, '');
      lines.push(
        present
          ? `![${slide.caption}](${rel})`
          : `_(missing screenshot \`${rel}\` — run \`npm run tutorials:capture\`)_`,
        '',
      );
    });
  }

  const dir = join(OUT, tutorial.id);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, 'slideshow.md');
  writeFileSync(target, lines.join('\n'));
  console.log(`wrote ${target}`);
}
