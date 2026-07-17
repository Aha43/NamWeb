import { describe, expect, it } from 'vitest';
import { formatQuestion, newQuestionValue, parseQuestion } from './resourceQuestion';
import { applyIntent } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import type { Resource } from './types';

describe('question resources (#827)', () => {
  it('parses and formats the tri-state', () => {
    expect(parseQuestion('?')).toEqual({ answer: null });
    expect(parseQuestion('')).toEqual({ answer: null });
    expect(parseQuestion('yes')).toEqual({ answer: 'yes' });
    expect(parseQuestion('no')).toEqual({ answer: 'no' });
    expect(parseQuestion('maybe')).toBeNull();
    expect(formatQuestion(null)).toBe('?');
    expect(formatQuestion('yes')).toBe('yes');
    expect(newQuestionValue()).toBe('?');
  });

  it('answerQuestionResource: SET semantics, stale-guarded, clear undoes', () => {
    let doc = createDefaultWorkspace();
    const inbox = doc.nodes[doc.inboxNodeId];
    const q: Resource = { type: 'QUESTION', value: '?', description: 'Bringing a tent?' };
    const note: Resource = { type: 'TEXT', value: 'hi', description: null };
    doc = {
      ...doc,
      nodes: {
        ...doc.nodes,
        a1: { ...inbox, id: 'a1', title: 'Camp', project: false, childIds: [], resources: [note, q] },
      },
    };

    // Answer yes.
    let next = applyIntent(doc, { type: 'answerQuestionResource', id: 'a1', index: 1, expectedValue: '?', answer: 'yes', now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('yes');
    expect(next.nodes['a1'].resources[1].description).toBe('Bringing a tent?'); // question untouched
    expect(next.nodes['a1'].updatedAt).toBe('T');

    // Switch to no.
    next = applyIntent(next, { type: 'answerQuestionResource', id: 'a1', index: 1, expectedValue: 'yes', answer: 'no', now: 'T2' });
    expect(next.nodes['a1'].resources[1].value).toBe('no');

    // Clear (the undo): back to unanswered.
    next = applyIntent(next, { type: 'answerQuestionResource', id: 'a1', index: 1, expectedValue: 'no', answer: 'clear', now: 'T3' });
    expect(next.nodes['a1'].resources[1].value).toBe('?');

    // Stale guard: a raced/replayed answer against a moved value no-ops.
    next = applyIntent(doc, { type: 'answerQuestionResource', id: 'a1', index: 1, expectedValue: 'yes', answer: 'no', now: 'T' });
    expect(next.nodes['a1'].resources[1].value).toBe('?');

    // Wrong type (index 0 is the TEXT note): untouched.
    next = applyIntent(doc, { type: 'answerQuestionResource', id: 'a1', index: 0, expectedValue: 'hi', answer: 'yes', now: 'T' });
    expect(next.nodes['a1'].resources[0].value).toBe('hi');

    // Unknown node: tolerated no-op.
    expect(() => applyIntent(doc, { type: 'answerQuestionResource', id: 'ghost', index: 0, expectedValue: '?', answer: 'yes', now: 'T' })).not.toThrow();
  });
});
