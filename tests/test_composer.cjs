const assert = require('node:assert/strict');
require('../docs/data.js');
require('../docs/engine.js');
require('../docs/composer.js');
const { Editor } = ABCDEComposer;
const checks = [];
function test(name, run) { run(); checks.push(name); }

test('Word addition keeps order and produces the existing water sentence', () => {
  const e = new Editor(8192);
  for (const word of ['BA', 'BACE', 'ADACA']) e.append(word);
  assert.equal(e.text, 'BA BACE ADACA');
  assert.equal(ABCDE.analyze(e.text).sentences[0].translation_candidates[0].id, 'i_want_water');
});
test('Omitted roles and ambiguous roles are not filled in', () => {
  const e = new Editor(8192);
  e.append('CEDA'); e.append('BA');
  assert.deepEqual(ABCDE.analyze(e.text).sentences[0].interpretations[0].roles, { subject: null, predicate: 0, object: 1 });
  e.clear(); e.append('CE'); e.append('DE');
  assert.equal(ABCDE.analyze(e.text).sentences[0].interpretations.length, 2);
});
test('Phrases add independent sentences, including repeated choices', () => {
  const e = new Editor(8192);
  e.append('BA'); e.append('A! CEDA', true); e.append('A! CEDA', true);
  assert.equal(e.text, 'BA\nA! CEDA\nA! CEDA');
  e.newSentence(); e.append('BA BACE ADACA', true);
  assert.equal(e.text, 'BA\nA! CEDA\nA! CEDA\nBA BACE ADACA');
});
test('Manual drafts remain exact, including unsupported native text', () => {
  const e = new Editor(8192);
  e.append('BA'); e.setMode('manual'); e.setText('水はいらない');
  e.setSource('en'); e.setText('I do not want water');
  e.setSource('abcde'); e.setText('[a b]'); e.setMode('build');
  assert.equal(e.text, 'BA'); e.append('CEDA');
  e.setMode('manual'); assert.equal(e.text, '[a b]');
  e.setSource('ja'); assert.equal(e.text, '水はいらない');
  e.setSource('en'); assert.equal(e.text, 'I do not want water');
});
test('Undo and redo restore edits and active draft together', () => {
  const e = new Editor(8192);
  e.append('BA'); e.setMode('manual'); e.setText('助けて');
  e.append('CEDA'); assert.equal(e.text, 'BA CEDA');
  e.undo(); assert.equal(e.state.mode, 'manual'); assert.equal(e.text, '助けて');
  e.redo(); assert.equal(e.state.mode, 'build'); assert.equal(e.text, 'BA CEDA');
});
test('Clear is reversible and does not clear other drafts', () => {
  const e = new Editor(8192);
  e.append('BA'); e.setMode('manual'); e.setText('助けて'); e.clear();
  assert.equal(e.text, ''); assert.equal(e.state.drafts.build, 'BA');
  e.undo(); assert.equal(e.text, '助けて'); e.redo(); assert.equal(e.text, '');
});
test('Typing coalesces and does not swallow a following card operation', () => {
  const e = new Editor(8192);
  e.setText('B'); e.setText('BA'); e.setText('BA '); e.append('CEDA');
  e.undo(); assert.equal(e.text, 'BA ');
  e.undo(); assert.equal(e.text, '');
  e.redo(); assert.equal(e.text, 'BA ');
  e.redo(); assert.equal(e.text, 'BA CEDA');
});
test('New edits after undo discard obsolete redo history', () => {
  const e = new Editor(8192);
  e.append('BA'); e.append('CE'); e.undo(); e.append('CEDA');
  assert.equal(e.canRedo, false); assert.equal(e.redo(), false);
  assert.equal(e.text, 'BA CEDA');
});
test('Append limit refuses the new operation without changing mode or drafts', () => {
  const e = new Editor(4);
  e.append('BA'); e.setMode('manual'); e.setText('x');
  const before = JSON.stringify(e.state), count = e.past.length;
  assert.equal(e.append('CEDA'), false);
  assert.equal(JSON.stringify(e.state), before); assert.equal(e.past.length, count);
});
test('Length is counted in Unicode code points and never truncates prior input', () => {
  const e = new Editor(3);
  e.append('🌊'); e.append('A'); assert.equal(e.text, '🌊 A');
  assert.equal(e.append('A'), false); assert.equal(e.text, '🌊 A');
  e.setText('🌊🌊🌊🌊'); assert.equal(e.text, '🌊🌊🌊🌊');
  assert.equal(e.newSentence(), false);
});
test('Newline is explicit, idempotent, and reversible', () => {
  const e = new Editor(8192);
  assert.equal(e.newSentence(), false);
  e.append('BA'); e.newSentence(); assert.equal(e.newSentence(), false);
  e.append('CEDA'); assert.equal(e.text, 'BA\nCEDA');
  e.undo(); e.undo(); assert.equal(e.text, 'BA');
});
test('Core-only setting survives draft navigation and can be undone', () => {
  const e = new Editor(8192);
  e.setCore(true); e.setMode('manual'); e.setSource('en');
  e.setMode('build'); assert.equal(e.state.core, true);
  e.setCore(false); e.undo(); assert.equal(e.state.core, true);
});
test('History keeps the most recent 100 changes without shared snapshots', () => {
  const e = new Editor(8192);
  for (let i = 0; i < 105; i++) e.append('BA');
  for (let i = 0; i < 100; i++) assert.equal(e.undo(), true);
  assert.equal(e.undo(), false); assert.equal(e.text, 'BA BA BA BA BA');
  e.redo(); e.setText('changed'); assert.equal(e.canRedo, false);
  e.undo(); assert.equal(e.text, 'BA BA BA BA BA BA');
});
test('Bad word order stays invalid rather than being rewritten', () => {
  const e = new Editor(8192);
  e.append('BA'); e.append('ADACA');
  assert.equal(e.text, 'BA ADACA'); assert.equal(ABCDE.analyze(e.text).status, 'invalid');
});
console.log(JSON.stringify({ checks, passed: checks.length }, null, 2));
