/* Browser port of abcde/interpreter.py. Data and diagnostic text are generated.
 * Keep the algorithm aligned with the Python reference; run full-JSON parity tests.
 * Classic script (no imports/fetch) also works when index.html is opened as a file.
 */
(() => {
  'use strict';
  const DATA = globalThis.ABCDE_DATA;
  const LANGUAGE = DATA.language, EXAMPLES = DATA.examples, GRAMMAR = LANGUAGE.grammar;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const length = text => Array.from(text).length; // Python counts Unicode code points.
  const whitespace = new Set(DATA.whitespace);
  const diagnostic = (code, details = {}) => ({ code, ...DATA.messages[code], ...details });
  class ParseError extends Error {
    constructor(code, suffix = '') {
      super(code);
      this.diagnostic = diagnostic(code);
      if (suffix) for (const lang of ['en', 'ja']) this.diagnostic[lang] += suffix;
    }
  }
  const fail = code => { throw new ParseError(code); };

  function atomize(word) {
    const chars = Array.from(word), atoms = [];
    for (let i = 0; i < chars.length;) {
      const size = 'AE'.includes(chars[i]) ? 1 : 2;
      const atom = chars.slice(i, i + size).join('');
      if (!has(LANGUAGE.atoms, atom)) throw new ParseError('INVALID_ATOM', word);
      atoms.push(atom);
      i += size;
    }
    if (!atoms.length) fail('EMPTY_WORD');
    return atoms;
  }

  function tokenize(line) {
    const words = [];
    let current = '', inside = false;
    for (const char of line) {
      const n = char.codePointAt(0);
      if (n < 32 || (n >= 127 && n <= 159) || n === 0x2028 || n === 0x2029) fail('CONTROL_CHARACTER');
      if (char === '[') {
        if (inside) fail('NESTED_BRACKET');
        inside = true;
      } else if (char === ']') {
        if (!inside) fail('UNMATCHED_BRACKET');
        inside = false;
      }
      if (char === ' ' && !inside) {
        if (current) words.push(current);
        current = '';
      } else current += char;
    }
    if (inside) fail('UNCLOSED_BRACKET');
    if (current) words.push(current);
    return words;
  }

  function parseTerm(surface, conventions = true) {
    let body = surface;
    const negated = body.startsWith(GRAMMAR.negation);
    if (negated) body = body.slice(GRAMMAR.negation.length);
    const count = body.match(/^[0-9]+/)?.[0] ?? null;
    if (count !== null) {
      if (count.length > 1 && count.startsWith('0')) fail('LEADING_ZERO');
      body = body.slice(count.length);
    }
    const external = /^\[[^\[\]]+\]$/u.test(body);
    if (external && Array.from(body.slice(1, -1)).every(char => whitespace.has(char))) fail('EMPTY_EXTERNAL');
    const atoms = external ? [] : atomize(body);
    const entry = conventions && has(LANGUAGE.conventions, body) ? LANGUAGE.conventions[body] : null;
    const literal = {};
    for (const lang of ['en', 'ja']) {
      let gloss;
      if (external) gloss = (lang === 'en' ? 'opaque label ' : '不透明な外部ラベル ') + body;
      else {
        gloss = LANGUAGE.atoms[atoms[atoms.length - 1]][lang];
        if (atoms.length > 1) gloss += '〈' + atoms.slice(0, -1).map(atom => LANGUAGE.atoms[atom][lang]).join(' + ') + '〉';
      }
      if (count !== null) gloss = count + ' × ' + gloss;
      if (negated) gloss = (lang === 'en' ? 'NOT(' : '否定(') + gloss + ')';
      literal[lang] = gloss;
    }
    return { surface, body, kind: external ? 'external' : 'word', count, negated, atoms,
      head: atoms[atoms.length - 1] ?? null, modifiers: atoms.slice(0, -1), literal,
      base_readings: entry ? entry.readings : [], convention_note: entry ? entry.note : null };
  }

  const isPredicate = term => term.count === null && GRAMMAR.predicate_heads.includes(term.head);
  function roleLiteral(roles, terms) {
    const result = {}, names = { en: ['subject', 'predicate', 'object/target'], ja: ['主語', '述語', '対象'] };
    for (const lang of ['en', 'ja']) {
      const unknown = lang === 'en' ? 'unspecified' : '未指定';
      result[lang] = ['subject', 'predicate', 'object'].map((role, i) =>
        names[lang][i] + '=' + (roles[role] === null ? unknown : terms[roles[role]].literal[lang])).join('; ');
    }
    return result;
  }

  function parseLine(original, conventions = true) {
    const line = has(GRAMMAR.shorthand, original) ? GRAMMAR.shorthand[original] : original;
    let words = tokenize(line);
    const notes = [];
    if (line !== original) notes.push(diagnostic('SHORTHAND'));
    let mood = 'unmarked', tense = 'unmarked';
    if (words.length && has(GRAMMAR.moods, words[0])) mood = GRAMMAR.moods[words.shift()];
    if (words.length && has(GRAMMAR.tenses, words[0])) tense = GRAMMAR.tenses[words.shift()];
    if (words.some(word => has(GRAMMAR.moods, word) || has(GRAMMAR.tenses, word))) fail('MARKER_ORDER');
    if (!words.length) fail('MISSING_BODY');
    let referenceWord = null;
    if (words.includes(GRAMMAR.linker) && words.length > 1) {
      const position = words.indexOf(GRAMMAR.linker);
      if (words.filter(word => word === GRAMMAR.linker).length !== 1 || position === 0 || position !== words.length - 2) fail('RELATION_SHAPE');
      referenceWord = words[words.length - 1];
      words = words.slice(0, position);
    }
    if (words.length > 3) fail('CLAUSE_LENGTH');
    const terms = words.map(word => parseTerm(word, conventions));
    let relation = null;
    if (referenceWord !== null) {
      terms.push(parseTerm(referenceWord, conventions));
      relation = { kind: 'unspecified', term: terms.length - 1, candidates: [] };
      notes.push(diagnostic('RELATION_UNSPECIFIED'));
      const reference = terms[terms.length - 1], time = LANGUAGE.time_convention;
      if (conventions && ['future', 'past'].includes(tense) && reference.count !== null && reference.body === time.unit && !reference.negated) {
        relation.candidates.push({ basis: time.id, quantity: reference.count, unit: 'day',
          direction: tense === 'future' ? 'after' : 'before', anchor: 'utterance', note: { en: time.en, ja: time.ja } });
      }
    }
    const size = words.length, interpretations = [];
    if (size === 3 && isPredicate(terms[1])) interpretations.push({ subject: 0, predicate: 1, object: 2 });
    else if (size === 2) {
      if (isPredicate(terms[1])) interpretations.push({ subject: 0, predicate: 1, object: null });
      if (isPredicate(terms[0])) interpretations.push({ subject: null, predicate: 0, object: 1 });
    } else if (size === 1 && isPredicate(terms[0])) interpretations.push({ subject: null, predicate: 0, object: null });
    const fragment = size === 1 && !isPredicate(terms[0]);
    if (fragment && relation !== null) fail('RELATION_WITHOUT_CLAUSE');
    if (!interpretations.length && !fragment) fail('NO_PREDICATE');
    terms.forEach((term, index) => {
      if (term.kind === 'external') notes.push(diagnostic('OPAQUE_EXTERNAL', { term: index }));
      else if (term.atoms.length > 1 && !has(LANGUAGE.conventions, term.body)) notes.push(diagnostic('UNKNOWN_COMPOUND', { term: index }));
      if (term.base_readings.length > 1) notes.push(diagnostic('LEXICAL_AMBIGUITY', { term: index }));
      if (has(LANGUAGE.legacy, term.body)) notes.push({ code: 'LEGACY_READING', ...LANGUAGE.legacy[term.body], term: index });
      if (term.negated) notes.push(diagnostic('WORD_NEGATION', { term: index }));
    });
    if (fragment) notes.push(diagnostic('FRAGMENT'));
    if (interpretations.length > 1) notes.push(diagnostic('ROLE_AMBIGUITY'));
    interpretations.forEach((roles, index) => {
      for (const role of ['subject', 'object']) {
        if (roles[role] === null) notes.push(diagnostic('UNSPECIFIED_' + role.toUpperCase(), { interpretation: index }));
      }
    });
    if (mood === 'emphasis') notes.push(diagnostic('EMPHASIS_NOT_COMMAND'));
    const normalized = tokenize(line).join(' '), candidates = [];
    if (conventions) for (const example of EXAMPLES) {
      if (example.abcde === normalized && example.candidate) candidates.push({ basis: 'survival_phrase', id: example.id,
        en: example.en, ja: example.ja, assumptions: example.assumptions });
    }
    const ambiguous = notes.some(note => ['ROLE_AMBIGUITY', 'LEXICAL_AMBIGUITY'].includes(note.code));
    return { input: original, normalized, status: ambiguous ? 'ambiguous' : 'valid', kind: fragment ? 'fragment' : 'clause', mood, tense,
      terms, relation, interpretations: interpretations.map(roles => ({ roles, literal: roleLiteral(roles, terms) })),
      translation_candidates: candidates, diagnostics: notes };
  }

  function analyze(text, conventions = true) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    const result = { language_version: LANGUAGE.version, conventions_enabled: conventions, sentences: [] };
    if (length(text) > DATA.max_input) return { ...result, status: 'invalid', diagnostics: [diagnostic('INPUT_LIMIT')] };
    text.replace(/\r\n/g, '\n').split('\n').forEach((raw, index) => {
      const line = raw.replace(/^ +| +$/g, '');
      if (!line) return;
      let sentence;
      try { sentence = parseLine(line, conventions); }
      catch (error) {
        if (!(error instanceof ParseError)) throw error;
        sentence = { input: line, status: 'invalid', diagnostics: [error.diagnostic] };
      }
      sentence.line = index + 1;
      result.sentences.push(sentence);
    });
    if (!result.sentences.length) return { ...result, status: 'invalid', diagnostics: [diagnostic('EMPTY_INPUT')] };
    const statuses = result.sentences.map(sentence => sentence.status);
    result.status = statuses.includes('invalid') ? 'invalid' : statuses.includes('ambiguous') ? 'ambiguous' : 'valid';
    return result;
  }

  function normalizePhrase(text, language) {
    text = Array.from(text, char => whitespace.has(char) ? ' ' : char).join('').replace(/^ +| +$/g, '').replace(/ +/g, ' ');
    return language === 'en' ? Array.from(text, char => has(DATA.casefold, char) ? DATA.casefold[char] : char).join('') : text;
  }
  function reverse(text, language = 'ja') {
    if (!['ja', 'en'].includes(language)) throw new Error('language must be ja or en');
    const normalized = normalizePhrase(text, language), matches = [];
    for (const example of EXAMPLES) {
      if (example.reverse[language].map(alias => normalizePhrase(alias, language)).includes(normalized)) {
        matches.push({ id: example.id, abcde: example.abcde, assumptions: example.assumptions, analysis: analyze(example.abcde) });
      }
    }
    return { language_version: LANGUAGE.version, input: text, source_language: language,
      status: matches.length ? 'supported' : 'unsupported', matches, note: DATA.reverse_note };
  }
  globalThis.ABCDE = Object.freeze({ analyze, reverse, atomize, normalizePhrase, maxInput: DATA.max_input });
})();
