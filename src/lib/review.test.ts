import { describe, expect, it } from 'vitest';
import { BUILT_IN_BY_ID } from './config';
import { focusOutcome } from './review';

const rate = (done: number, required: number) => ({ habit: BUILT_IN_BY_ID.protein, done, required, rate: required ? done / required : 0 });

describe('focus follow-up', () => {
  it('moves on once the habit is nailed, and sticks with it otherwise', () => {
    expect(focusOutcome(rate(7, 7), rate(3, 7))).toMatchObject({ keep: false, color: 'teal' });
    expect(focusOutcome(rate(5, 7), rate(3, 7))).toMatchObject({ keep: true, color: 'teal' });
    expect(focusOutcome(rate(2, 7), rate(4, 7))).toMatchObject({ keep: true, color: 'orange' });
    expect(focusOutcome(rate(3, 7), rate(3, 7))).toMatchObject({ keep: true, color: 'orange' });
    expect(focusOutcome(rate(3, 7), undefined).keep).toBe(true);
    expect(focusOutcome(rate(0, 0), rate(3, 7))).toMatchObject({ keep: false, color: 'gray' });
  });
});
