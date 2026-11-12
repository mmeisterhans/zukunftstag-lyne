import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestions, validateQuestions } from './questions.mjs';

const source = 'Die Römer bauten Strassen, damit Soldaten schnell reisen konnten.';
const item = { question: 'Warum waren Strassen für die römische Armee wichtig?', answer: 'Soldaten konnten auf ihnen schnell reisen.', evidence: source };
const completed = data => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }) });

test('accepts grounded questions and normalizes whitespace in evidence', () => {
  assert.equal(validateQuestions({ questions: [item] }, source.replace('bauten ', 'bauten\n')).length, 1);
});
test('rejects evidence invented by the model', () => {
  assert.throws(() => validateQuestions({ questions: [{ ...item, evidence: 'Alle Römer besassen Autos.' }] }, source));
});
test('rejects gaps, summaries, duplicate questions and empty lists', () => {
  for (const question of ['Welches Wort fehlt?', 'Die Römer bauten ____?', 'Schreibe eine Zusammenfassung.']) {
    assert.throws(() => validateQuestions({ questions: [{ ...item, question }] }, source));
  }
  assert.throws(() => validateQuestions({ questions: [item, item] }, source));
  assert.throws(() => validateQuestions({ questions: [] }, source));
});
test('requests structured comprehension questions; keeps the API key in the request header', async () => {
  let called = false;
  const result = await createQuestions(source, { apiKey: 'test-only', fetchImpl: async (url, options) => {
    called = true;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.input[0].content[0].text, source);
    assert.match(body.instructions, /Keine Zusammenfassung, keine Lückentexte/);
    assert.equal(options.body.includes('test-only'), false);
    return completed({ questions: [item] });
  } });
  assert.equal(called, true);
  assert.deepEqual(result, [item]);
});
test('requires a configured key and valid source before making any request', async () => {
  const fetchImpl = async () => { throw new Error('unexpected network request'); };
  await assert.rejects(() => createQuestions(source, { fetchImpl }), /noch nicht eingerichtet/);
  await assert.rejects(() => createQuestions('kurz', { apiKey: 'test-only', fetchImpl }), /10 bis/);
  await assert.rejects(() => createQuestions('x'.repeat(20001), { apiKey: 'test-only', fetchImpl }), /10 bis/);
});
test('handles API refusals and incomplete responses', async () => {
  for (const payload of [
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] },
    { status: 'incomplete', output: [] }
  ]) {
    await assert.rejects(() => createQuestions(source, { apiKey: 'test-only', fetchImpl: async () => ({ ok: true, json: async () => payload }) }));
  }
});
test('handles malformed model JSON and API errors', async () => {
  await assert.rejects(() => createQuestions(source, { apiKey: 'test-only', fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'invalid JSON' }] }] }) }) }), /keine lesbaren Fragen/);
  await assert.rejects(() => createQuestions(source, { apiKey: 'test-only', fetchImpl: async () => ({ ok: false, status: 429 }) }), /API-Guthaben/);
});
