// Sparky's "simple mode": a few built-in commands that work without any AI API key.

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  "I told my computer I needed a break. It said: 'No problem, I'll go to sleep.'",
  'Why did the database break up with the spreadsheet? Too many cells, not enough relations.',
  'There are 10 kinds of people: those who understand binary and those who don\'t.',
];

const HELP = `I'm in simple mode right now. Try:
• "hi"
• "time" or "date"
• "joke"
• "flip a coin" or "roll a dice"
• "calc 12 * (3 + 4)"`;

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export function simpleReply(message: string): string {
  const text = message.trim().toLowerCase();

  // Maths: "calc 2+3", "what is 7 * 6", or just "2+3"
  const maths = text.replace(/^(calc|calculate|what is|what's)\s*/, '').replace(/[?=]+$/, '').trim();
  if (/\d/.test(maths) && /^[\d\s+\-*/().%]+$/.test(maths)) {
    const result = calculate(maths);
    return result === null ? "I couldn't work that one out. Check the brackets?" : `${maths} = ${result}`;
  }

  if (/\b(hi|hello|hey|yo)\b/.test(text)) return "Hi! I'm Sparky. Type \"help\" to see what I can do.";
  if (/\bhelp\b/.test(text)) return HELP;
  if (/\btime\b/.test(text)) return `It's ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} on the server.`;
  if (/\b(date|today|day)\b/.test(text)) return `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;
  if (/\bjoke\b/.test(text)) return pick(JOKES);
  if (/\b(coin|flip)\b/.test(text)) return `🪙 ${pick(['Heads', 'Tails'])}!`;
  if (/\b(dice|die|roll)\b/.test(text)) return `🎲 You rolled a ${1 + Math.floor(Math.random() * 6)}.`;
  if (/\b(thanks|thank you|thx)\b/.test(text)) return 'Any time! ⚡';

  return `I'm not sure about that one yet. ${HELP}`;
}

// A tiny calculator: + - * / % and brackets. It never runs the text as code (no eval).
export function calculate(input: string): number | null {
  const tokens = input.match(/\d+(\.\d+)?|[+\-*/%()]/g) ?? [];
  let i = 0;

  // expression = term (("+" | "-") term)*
  const expression = (): number => {
    let value = term();
    while (tokens[i] === '+' || tokens[i] === '-') value = tokens[i++] === '+' ? value + term() : value - term();
    return value;
  };
  // term = factor (("*" | "/" | "%") factor)*
  const term = (): number => {
    let value = factor();
    while (tokens[i] === '*' || tokens[i] === '/' || tokens[i] === '%') {
      const op = tokens[i++];
      const right = factor();
      value = op === '*' ? value * right : op === '/' ? value / right : value % right;
    }
    return value;
  };
  // factor = number | "(" expression ")" | "-" factor
  const factor = (): number => {
    const token = tokens[i++];
    if (token === '-') return -factor();
    if (token === '(') {
      const value = expression();
      if (tokens[i++] !== ')') throw new Error('missing )');
      return value;
    }
    const value = Number(token);
    if (Number.isNaN(value)) throw new Error('bad number');
    return value;
  };

  try {
    const result = expression();
    if (i !== tokens.length || !Number.isFinite(result)) return null;
    return Math.round(result * 1e10) / 1e10; // hide floating-point noise like 0.30000000000000004
  } catch {
    return null;
  }
}
