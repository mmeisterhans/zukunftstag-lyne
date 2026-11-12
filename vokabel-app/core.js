'use strict';
globalThis.VocabCore = (() => {
  function cleanWord(value) {
    return value
      .replace(/\[[^\]]*\]/gu, ' ')
      .replace(/\/([^/\n]+)\//gu, (whole, inside) => /[ˈˌəɪʊʌɑɒɔɛæɜɚɝθðʃʒŋɡɐɹːˑœøʁɲɥʏɾʔ̃]/u.test(inside) || !/\s/u.test(inside) ? ' ' : whole)
      .replace(/\((?:[^)]*[ˈˌəɪʊʌɑɒɔɛæɜθðʃʒŋː][^)]*|n\.|v\.|adj\.|adv\.|noun|verb|adjective|adverb)\)/giu, ' ')
      .replace(/[ˈˌːˑ]/gu, '')
      .replace(/^[\s•*]+|[\s*]+$/gu, '').replace(/\s+/gu, ' ').trim();
  }
  function parseList(text) {
    const pairs = [], skipped = [];
    for (const [index, raw] of text.split(/\r?\n/u).entries()) {
      if (!raw.trim()) continue;
      const line = cleanWord(raw.replace(/^\s*\d+[.)]\s*/u, ''));
      // Prefer explicit columns; avoid splitting hyphens within compound words.
      const separator = /\t+|\s*[;=–—]\s*|\s+-\s+|\s*:\s+| {2,}/u;
      // Preserve tabs / column spacing until after finding the boundary.
      const columns = raw.replace(/^\s*\d+[.)]\s*/u, '').replace(/\[[^\]]*\]/gu, '').split(/\t+|\s*[;=–—]\s*|\s+-\s+|\s*:\s+| {2,}/u);
      let left, right;
      if (columns.length === 2) [left, right] = columns.map(cleanWord);
      else {
        const match = separator.exec(line);
        if (match) { left = cleanWord(line.slice(0, match.index)); right = cleanWord(line.slice(match.index + match[0].length)); }
      }
      if (!left || !right) { skipped.push(index + 1); continue; }
      pairs.push({ left, right });
    }
    return { pairs, skipped };
  }
  function normalizeAnswer(value) {
    return value.normalize('NFC').toLocaleLowerCase().trim().replace(/[.!?]+$/u, '').replace(/\s+/gu, ' ');
  }
  function isCorrect(value, expected) {
    const answer = normalizeAnswer(value);
    return !!answer && expected.split(/\s*[/|]\s*/u).some(option => normalizeAnswer(option) === answer);
  }
  function buildRound(pairs, direction, shuffle, random = Math.random) {
    const cards = pairs.map(pair => {
      const reverse = direction === 'reverse' || (direction === 'mixed' && random() < .5);
      return { prompt: reverse ? pair.right : pair.left, answer: reverse ? pair.left : pair.right, reverse };
    });
    if (shuffle) for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  return { cleanWord, parseList, normalizeAnswer, isCorrect, buildRound };
})();
