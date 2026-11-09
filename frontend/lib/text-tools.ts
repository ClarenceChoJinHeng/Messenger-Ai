// Sparky's free writing helpers: plain rules that run in the browser (no AI, no server, no cost).
// polish()    fixes capitals, apostrophes, chat slang, stretched words, punctuation and spacing
// shorten()   polish + removes filler words and wordy phrases
// summarize() keeps the most important sentences of a long message

// Chat slang → full words (matched as whole words, any capitalisation)
const SLANG: Record<string, string> = {
  u: "you", ur: "your", r: "are", ya: "you", pls: "please", plz: "please", thx: "thanks", thnx: "thanks",
  ty: "thank you", idk: "I don't know", imo: "in my opinion", btw: "by the way", rn: "right now",
  tmr: "tomorrow", tmrw: "tomorrow", msg: "message", bc: "because", cuz: "because", coz: "because",
  wanna: "want to", gonna: "going to", gotta: "got to", abt: "about", b4: "before", "2day": "today",
  gr8: "great", ppl: "people", smth: "something", sth: "something", nvm: "never mind", ofc: "of course",
};

// Missing apostrophes (only words that can't be anything else)
const APOSTROPHES: Record<string, string> = {
  dont: "don't", cant: "can't", wont: "won't", im: "I'm", ive: "I've", isnt: "isn't", arent: "aren't",
  wasnt: "wasn't", werent: "weren't", didnt: "didn't", doesnt: "doesn't", havent: "haven't", hasnt: "hasn't",
  couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", thats: "that's", whats: "what's",
  youre: "you're", theyre: "they're", shes: "she's", theres: "there's", wheres: "where's", hows: "how's",
  lets: "let's", youve: "you've", theyve: "they've", weve: "we've", youll: "you'll", theyll: "they'll",
};

// Words and phrases that can usually go without changing the meaning
const FILLER: [RegExp, string][] = [
  [/\bdue to the fact that\b/gi, "because"],
  [/\bin order to\b/gi, "to"],
  [/\bat this point in time\b/gi, "now"],
  [/\bin the event that\b/gi, "if"],
  [/\bfor the purpose of\b/gi, "for"],
  [/\bi was wondering if (you|we|they|I) (could|can|would)\b/gi, "$2 $1"], // "I was wondering if you could" → "could you"
  [/\bi was wondering if\b/gi, ""],
  [/\bi just wanted to say( that)?\b/gi, ""],
  [/\b(you know|kind of|sort of),?\s*/gi, ""],
  [/\b(just|really|very|basically|actually|literally|totally|honestly|simply|quite)\s+/gi, ""],
  [/\blike,\s*/gi, ""],
];

const QUESTION_START = /^(who|what|when|where|why|how|is|are|am|do|does|did|can|could|would|will|should|shall|may|have|has)\b/i;
const EMOJI_END = /\p{Extended_Pictographic}️?$/u;
const LAUGH_END = /\b(lol|lmao|haha+|hehe+|xd)$/i; // casual endings that look odd with a full stop

// Replace whole words from a dictionary, keeping a capital first letter if there was one
function replaceWords(text: string, dict: Record<string, string>) {
  return text.replace(/\b[\w']+\b/g, (word) => {
    const found = dict[word.toLowerCase()];
    if (!found) return word;
    return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()
      ? found[0].toUpperCase() + found.slice(1)
      : found;
  });
}

// "sooooo" → "so", "heyyyy" → "hey", "goooood" → "good": only words with a letter 3+ times in a row
function unstretch(text: string) {
  return text.replace(/\b[a-z]*([a-z])\1{2,}[a-z]*\b/gi, (word) => {
    const two = word.replace(/([a-z])\1{2,}/gi, "$1$1");
    // short words ending in a doubled letter were stretched at the end: "soo" → "so", "heyy" → "hey"
    return two.length <= 4 && /([a-z])\1$/i.test(two) ? two.slice(0, -1) : two;
  });
}

// Capital letter at the start of each sentence (after . ! ? or a new line)
function capitalise(text: string) {
  return text.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}

// Tidy one line (links are left exactly as they are)
function polishLine(line: string) {
  const parts = line.split(/(\S+:\/\/\S+)/); // keep URLs untouched
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // a URL
      let t = part.replace(/[ \t]+/g, " ");
      t = unstretch(t);
      // "ur" before a doing-word or describing word means "you're": "ur talking", "ur so kind"
      t = t.replace(/\bur(?=\s+(\w+ing|so|too|very|right|welcome|not|the best|kidding|amazing|late|here|there)\b)/gi, "you're");
      t = replaceWords(t, SLANG);
      t = replaceWords(t, APOSTROPHES);
      t = t.replace(/\bi\b/g, "I").replace(/\bi'(m|ve|ll|d)\b/gi, (_, s: string) => `I'${s.toLowerCase()}`);
      t = t.replace(/\b(\w+)(\s+\1\b)+/gi, "$1"); // "the the" → "the"
      t = t.replace(/([!?])\1+/g, "$1").replace(/\.{4,}/g, "..."); // "!!!" → "!", "......" → "..."
      t = t.replace(/\s+([,.!?;:])/g, "$1"); // no space before punctuation
      t = t.replace(/([,;:])(?=[^\s\d])/g, "$1 "); // a space after commas (not inside numbers like 1,000)
      return t;
    })
    .join("");
}

export function polish(text: string): string {
  let t = text
    .split("\n")
    .map(polishLine)
    .join("\n")
    .trim();
  t = capitalise(t);
  // End with a full stop or question mark (not after an emoji, a link, or for 1–3 word messages)
  const last = t.split("\n").at(-1) ?? "";
  if (/[\p{L}\d]$/u.test(t) && !EMOJI_END.test(t) && !LAUGH_END.test(t) && !/\S+:\/\/\S+$/.test(t) && last.split(/\s+/).length >= 4) {
    t += QUESTION_START.test(last.split(/[.!?]\s+/).at(-1) ?? "") ? "?" : ".";
  }
  return t;
}

export function shorten(text: string): string {
  let t = polish(text);
  for (const [pattern, replacement] of FILLER) t = t.replace(pattern, replacement);
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/(^|\n)\s*,\s*/g, "$1").trim();
  t = capitalise(t);
  // Removing words can turn the last sentence into a question ("Could you…"): end it with "?"
  const lastSentence = t.split(/(?<=[.!?])\s+/).at(-1) ?? "";
  if (QUESTION_START.test(lastSentence) && t.endsWith(".")) t = t.slice(0, -1) + "?";
  return t;
}

// Common words that don't tell us what a sentence is about
const STOPWORDS = new Set(
  "a an the and or but if so to of in on at for with from by as is are was were be been am i you he she it we they me my your our their this that these those there here what which who whom do does did have has had will would can could should not no yes just very really also then than too about into over after before again more most some any all only own same such up down out off".split(" "),
);

// Extractive summary: score each sentence by how often its important words appear in the whole message,
// keep the best third (1 to 3 sentences), in their original order
export function summarize(text: string): string {
  const clean = polish(text);
  const sentences = clean.match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (sentences.length < 3) return shorten(clean); // too short to summarise: just make it tighter

  const freq = new Map<string, number>();
  const wordsOf = (s: string) => (s.toLowerCase().match(/[\p{L}\d']+/gu) ?? []).filter((w) => !STOPWORDS.has(w) && w.length > 2);
  for (const w of wordsOf(clean)) freq.set(w, (freq.get(w) ?? 0) + 1);

  const scored = sentences.map((s, i) => {
    const words = wordsOf(s);
    const score = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.max(1, Math.sqrt(words.length));
    return { s, i, score: score + (i === 0 ? 0.5 : 0) }; // the first sentence usually sets the topic
  });
  const keep = Math.min(3, Math.max(1, Math.ceil(sentences.length / 3)));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, keep)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
    .join(" ");
}
