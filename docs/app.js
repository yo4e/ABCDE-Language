/* UI only: all parsing is in engine.js, all language data comes from data.js. */
(() => {
  'use strict';
  const DATA = globalThis.ABCDE_DATA, API = globalThis.ABCDE;
  const $ = id => document.getElementById(id);
  const form = $('translator'), source = $('source'), input = $('text'), core = $('core-only'), result = $('result');
  const status = { valid: '構造は有効です', ambiguous: '複数の読みがあります', invalid: '入力の形を確認してください',
    supported: '登録された表現が見つかりました', unsupported: 'この表現は未対応です' };
  const directions = { ja: '日本語 → ABCDE', en: 'English → ABCDE', abcde: 'ABCDE → 日本語・English' };
  // Every dynamic string becomes a text node; inputs never enter innerHTML.
  const el = (tag, className, ...children) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children.flat());
    return node;
  };
  const p = (text, className = '') => el('p', className, text);
  const code = text => el('code', '', text);
  function bilingual(value) {
    const english = p(value.en, 'english');
    english.lang = 'en';
    return [p(value.ja), english];
  }
  function diagnostics(notes, terms = []) {
    const list = el('ul', 'notices');
    for (const note of notes) {
      const item = el('li', '');
      if (note.term !== undefined) item.append(el('strong', '', code(terms[note.term].surface)));
      else if (note.interpretation !== undefined) item.append(el('strong', '', '構造 ' + (note.interpretation + 1)));
      item.append(...bilingual(note));
      list.append(item);
    }
    return notes.length ? [list] : [];
  }
  function renderAnalysis(analysis) {
    const nodes = diagnostics(analysis.diagnostics || []);
    for (const sentence of analysis.sentences) {
      const section = el('section', 'sentence', el('div', 'sentence-heading',
        el('h3', '', el('span', 'eyebrow', sentence.line + ' 文目'), code(sentence.input)),
        el('span', 'badge ' + sentence.status, status[sentence.status])));
      if (sentence.status !== 'invalid') {
        const moods = { unmarked: '発話意図は未指定', emphasis: '強調（命令とは限りません）', question: '疑問' };
        const tenses = { unmarked: '時間は未指定', future: '未来', past: '過去' };
        section.append(p(moods[sentence.mood] + ' · ' + tenses[sentence.tense], 'muted'));
        if (analysis.conventions_enabled && !sentence.translation_candidates.length) {
          section.append(p('文全体の慣用訳は登録されていません。構造と語ごとの候補を確認できます。', 'muted'));
        }
      }
      if (sentence.translation_candidates?.length) section.append(el('h4', '', '慣用による文の候補'));
      for (const candidate of sentence.translation_candidates || []) {
        section.append(el('div', 'candidate', bilingual(candidate),
          el('div', 'assumptions', el('strong', '', 'この読みの前提'), bilingual(candidate.assumptions))));
      }
      for (const term of sentence.terms || []) {
        if (term.base_readings.length > 1) {
          section.append(el('div', 'lexical', el('h4', '', code(term.surface), ' の語の候補'),
            p('基本語の読みです。数量・否定を適用する前の候補を、選ばず残しています。', 'hint'),
            bilingual({ ja: term.base_readings.map(r => r.ja).join(' / '), en: term.base_readings.map(r => r.en).join(' / ') })));
        }
      }
      (sentence.interpretations || []).forEach((interpretation, i) => {
        const roles = el('dl', 'roles');
        for (const [role, label] of [['subject', '主語'], ['predicate', '述語'], ['object', '対象']]) {
          const index = interpretation.roles[role];
          roles.append(el('div', '', el('dt', '', label), el('dd', '',
            index === null ? el('span', 'unspecified', '未指定') : code(sentence.terms[index].surface))));
        }
        section.append(el('div', 'structure', el('h4', '', '構造 ' + (i + 1) + ' / 直訳'), roles, bilingual(interpretation.literal)));
      });
      if (sentence.kind === 'fragment') section.append(p('語の断片です。主語・述語などの文の役割は補いません。', 'notice'));
      if (sentence.relation) {
        const relation = el('div', 'relation', el('h4', '', '関係 E'), p('関係の種類は未指定です。'));
        for (const candidate of sentence.relation.candidates) {
          relation.append(p('慣用の時間候補：発話時点から ' + candidate.quantity + ' 日' + (candidate.direction === 'after' ? '後' : '前')),
            ...bilingual(candidate.note));
        }
        section.append(relation);
      }
      section.append(...diagnostics(sentence.diagnostics, sentence.terms));
      if (sentence.terms?.length) {
        const terms = el('details', 'terms', el('summary', '', '語を分解して見る（直訳・慣用候補）'));
        for (const term of sentence.terms) {
          const article = el('article', '', el('h4', '', code(term.surface)),
            p(term.atoms.join(' + ') || '外部ラベル：内容は解釈しません', 'atoms'));
          if (term.negated) article.append(p('否定：この語全体を否定しています。', 'notice'));
          if (term.count !== null) article.append(p('数量：' + term.count));
          article.append(el('strong', '', '直訳'), ...bilingual(term.literal));
          if (term.base_readings.length) article.append(p('基本語の慣用候補（数量・否定を適用する前）', 'term-label'),
            el('ul', '', term.base_readings.map(reading => el('li', '', bilingual(reading)))), ...bilingual(term.convention_note));
          terms.append(article);
        }
        section.append(terms);
      }
      nodes.push(section);
    }
    return nodes;
  }

  const initial = Array.from(result.childNodes, node => node.cloneNode(true));
  function showResult(value, text, direction, coreOnly) {
    result.replaceChildren(el('div', 'submission', el('span', 'eyebrow', '確認した入力 · ' + directions[direction]), code(text)),
      el('h2', '', status[value.status]));
    if (coreOnly) result.append(p('アトムと構文のみ。語・文・時間の慣用候補は表示していません。', 'notice'));
    if (value.matches) {
      result.append(el('div', 'lookup-note', bilingual(value.note)));
      if (!value.matches.length) result.append(p('「使える日本語・英語の一覧」から選べます。近い表現への自動置き換えはしません。'));
      for (const match of value.matches) {
        result.append(el('div', 'answer', el('span', 'eyebrow', 'ABCDE'), code(match.abcde)), ...renderAnalysis(match.analysis));
      }
    } else result.append(...renderAnalysis(value));
    $('announcement').textContent = status[value.status];
    result.focus();
  }
  function translate() {
    const text = input.value, direction = source.value, coreOnly = direction === 'abcde' && core.checked;
    if (Array.from(text).length > API.maxInput || !text.trim()) {
      result.replaceChildren(el('h2', '', '入力を確認してください'), p('1〜8192文字を入力するか、例文を選んでください。', 'notice'));
      $('announcement').textContent = '入力を確認してください';
      result.focus();
      return;
    }
    const value = direction === 'abcde' ? API.analyze(text, !coreOnly) : API.reverse(text, direction);
    showResult(value, text, direction, coreOnly);
  }
  function directionChanged() {
    core.disabled = source.value !== 'abcde';
    if (core.disabled) core.checked = false;
  }
  function sampleButton(direction, text) {
    const button = el('button', 'sample', text);
    button.type = 'button';
    button.addEventListener('click', () => {
      source.value = direction;
      input.value = text;
      core.checked = false;
      directionChanged();
      translate();
    });
    return button;
  }
  for (const [direction, id] of [['ja', 'want_water'], ['ja', 'help_unspecified'], ['ja', 'do_not_eat'],
    ['en', 'i_want_water'], ['abcde', 'ambiguous_roles'], ['abcde', 'return_three_days']]) {
    const example = DATA.examples.find(example => example.id === id);
    $('samples').append(sampleButton(direction, direction === 'abcde' ? example.abcde : example.reverse[direction][0]));
  }
  for (const direction of ['ja', 'en']) {
    const buttons = el('div', 'samples');
    for (const example of DATA.examples) for (const alias of example.reverse[direction]) {
      const button = sampleButton(direction, alias);
      button.classList.add('compact');
      buttons.append(button);
    }
    $('phrases').append(el('h3', '', direction === 'ja' ? '日本語' : 'English'), buttons);
  }
  form.addEventListener('submit', event => { event.preventDefault(); translate(); });
  source.addEventListener('change', directionChanged);
  $('clear').addEventListener('click', () => {
    input.value = '';
    result.replaceChildren(...initial.map(node => node.cloneNode(true)));
    $('announcement').textContent = '入力と結果をクリアしました';
    input.focus();
  });
  $('version').textContent = '言語仕様 ' + DATA.language.version;
  $('translate').disabled = false;
  $('clear').disabled = false;
  $('loading').hidden = true;
})();
