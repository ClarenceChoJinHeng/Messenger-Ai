import { calculate, simpleReply } from './simple-bot.js';

describe('calculate', () => {
  it('follows maths order (× before +)', () => {
    expect(calculate('2 + 3 * 4')).toBe(14);
  });
  it('handles brackets, minus signs and decimals', () => {
    expect(calculate('12 * (3 + 4)')).toBe(84);
    expect(calculate('-5 + 2')).toBe(-3);
    expect(calculate('0.1 + 0.2')).toBe(0.3);
  });
  it('returns null for broken input or dividing by zero', () => {
    expect(calculate('(1 + 2')).toBeNull();
    expect(calculate('1 / 0')).toBeNull();
  });
});

describe('simpleReply', () => {
  it('answers maths questions', () => {
    expect(simpleReply('calc 7 * 6')).toBe('7 * 6 = 42');
    expect(simpleReply('What is 10 / 4?')).toBe('10 / 4 = 2.5');
  });
  it('answers greetings and help', () => {
    expect(simpleReply('Hello!')).toContain('Sparky');
    expect(simpleReply('help')).toContain('calc');
  });
  it('rolls a number from 1 to 6', () => {
    const n = Number(simpleReply('roll a dice').match(/\d/)?.[0]);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(6);
  });
});
