// The QUESTION resource (#827): a tri-state yes/no a guest can answer on a shared page — the
// second interactive resource type. Value packs the answer for MACHINES ("yes" / "no" / "?"
// = unanswered); the question text lives in `description` for HUMANS (the family invariant).
// Guest-answerable "as counters": auto-drain, no adopt ceremony (design-doc guestPolicy = auto).

export type QuestionAnswer = 'yes' | 'no';

export interface QuestionState {
  /** null = unanswered. */
  answer: QuestionAnswer | null;
}

/** Parse a QUESTION value. Null for anything malformed — render as plain text then. */
export function parseQuestion(value: string): QuestionState | null {
  const v = value.trim();
  if (v === '?' || v === '') return { answer: null };
  if (v === 'yes') return { answer: 'yes' };
  if (v === 'no') return { answer: 'no' };
  return null;
}

export function formatQuestion(answer: QuestionAnswer | null): string {
  return answer ?? '?';
}

/** A fresh, unanswered question. */
export function newQuestionValue(): string {
  return '?';
}
