// Staleness mapper for the tutorial-sync routine (see docs/features/tutorial-sync/design.md).
//
// Pure logic: given the files changed since the `.tutorials-synced` marker and the CHANGELOG
// `[Unreleased]` text, decide which tutorials in the catalog a change may have made stale. It only
// *proposes* — the /refresh-tutorials skill run confirms before regenerating and opening the
// NamProduct issue. Kept deliberately simple and dependency-free so it is trivially unit-testable.

import { tutorials as defaultCatalog, type Tutorial } from './catalog';

/** True when a surface entry is a source-path glob rather than a plain changelog keyword. */
export function isPathGlob(surface: string): boolean {
  return surface.includes('/') || surface.includes('*');
}

/**
 * Convert a simple path glob to an anchored RegExp.
 *  • `*`   matches within a single path segment (no `/`).
 *  • `**`  matches across segments.
 *  • a `**` immediately followed by `/` matches zero or more leading segments, so the glob
 *    `src/` + `**` + `/Inbox*` matches both `src/InboxPage.tsx` and `src/routes/inbox/InboxPage.tsx`.
 */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?'; // **/ → optional leading segments
        i += 3;
      } else {
        re += '.*'; // ** → any depth
        i += 2;
      }
    } else if (c === '*') {
      re += '[^/]*';
      i += 1;
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      re += '\\' + c; // escape regex metacharacters ('/' needs none)
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp('^' + re + '$');
}

export interface StalenessInput {
  /** Repo-relative paths changed since the marker (e.g. `git diff --name-only <marker>..main`). */
  changedPaths: string[];
  /** The CHANGELOG `[Unreleased]` section text (or any change summary to keyword-match). */
  changelogText: string;
}

/** The tutorials a change may have made stale, with the surfaces that flagged each one. */
export interface StaleTutorial {
  tutorial: Tutorial;
  /** The `surfaces` entries that matched — the "why" shown in the NamProduct issue. */
  matched: string[];
}

/**
 * Map a change to the tutorials it may have made stale. A path glob matches against `changedPaths`;
 * a keyword matches (case-insensitive substring) against `changelogText`.
 */
export function affectedTutorials(
  input: StalenessInput,
  catalog: Tutorial[] = defaultCatalog,
): StaleTutorial[] {
  const haystack = input.changelogText.toLowerCase();
  const results: StaleTutorial[] = [];
  for (const tutorial of catalog) {
    const matched = tutorial.surfaces.filter((surface) => {
      if (isPathGlob(surface)) {
        const re = globToRegExp(surface);
        return input.changedPaths.some((p) => re.test(p));
      }
      return haystack.includes(surface.toLowerCase());
    });
    if (matched.length > 0) results.push({ tutorial, matched });
  }
  return results;
}
