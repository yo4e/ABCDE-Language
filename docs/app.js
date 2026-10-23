/* UI only: all parsing is in engine.js, all language data comes from data.js. */
(() => {
  'use strict';
  const DATA = globalThis.ABCDE_DATA, API = globalThis.ABCDE;
  const $ = id => document.getElementById(id);
  const form = $('translator'), source = $('source'), input = $('text'), core = $('core-only'), result = $('result');
  const editor = new ABCDEComposer.Editor(API.maxInput);
  let lastParsed = null;
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
  const signature = () => JSON.stringify([editor.text, editor.direction, editor.direction === 'abcde' && editor.state.core]);
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
    lastParsed = signature();
    result.focus();
  }
  function translate() {
    const text = editor.text, direction = editor.direction, coreOnly = direction === 'abcde' && editor.state.core;
    if (Array.from(text).length > API.maxInput || !text.trim()) {
      result.replaceChildren(el('h2', '', '入力を確認してください'), p('1〜8192文字を入力するか、語・例文を追加してください。', 'notice'));
      lastParsed = signature();
      $('announcement').textContent = '入力を確認してください';
      result.focus();
      return;
    }
    const value = direction === 'abcde' ? API.analyze(text, !coreOnly) : API.reverse(text, direction);
    showResult(value, text, direction, coreOnly);
  }
  function previewWords() {
    const preview = $('word-preview');
    preview.replaceChildren();
    preview.hidden = editor.state.mode !== 'build' || !editor.text;
    if (preview.hidden) return;
    preview.append(p('語の慣用ラベル · 文の訳は「読みを確認」で', 'hint'));
    let count = 0;
    for (const line of editor.text.split('\n')) {
      if (!line) continue;
      const row = el('div', 'token-row');
      let words;
      try { words = API.tokenize(line); }
      catch { words = [line]; }
      for (const word of words) {
        if (++count > 60) { preview.append(p('続きは入力欄に保持しています。', 'hint')); return; }
        const entry = Object.prototype.hasOwnProperty.call(DATA.language.conventions, word) ? DATA.language.conventions[word] : null;
        const chip = el('span', 'token-chip', code(word));
        if (entry) chip.append(el('span', '', entry.readings.map(r => r.ja).join(' / ')),
          el('span', 'english', entry.readings.map(r => r.en).join(' / ')));
        row.append(chip);
      }
      preview.append(row);
    }
  }
  function sync() {
    const building = editor.state.mode === 'build';
    source.value = editor.state.source;
    if (input.value !== editor.text) input.value = editor.text;
    $('mode-build').setAttribute('aria-pressed', String(building));
    $('mode-manual').setAttribute('aria-pressed', String(!building));
    $('direction-control').hidden = building;
    $('builder-choices').hidden = !building;
    $('text-label').textContent = building ? '組み立てた文章（ABCDE）' : '入力する言葉';
    input.placeholder = building ? '下の語カードを押すと、ここに追加されます' : '水がほしい / A! CEDA';
    $('input-help').textContent = building ? '語は末尾に追加、例文は新しい行に追記します。上限8192文字です。'
      : '方向ごとに下書きを保持します。日本語・英語は登録表現のみ。ABCDEの文は改行で区切ります。上限8192文字です。';
    const labels = { ja: '日本語', en: 'English', abcde: 'ABCDE' };
    const drafts = ['ja', 'en', 'abcde'].filter(key => editor.state.drafts[key]).map(key => labels[key]);
    $('draft-note').textContent = drafts.length ? '手入力の下書きを保持中：' + drafts.join('・')
      : '手入力の下書きも、翻訳方向ごとに保持します。';
    core.disabled = editor.direction !== 'abcde';
    core.checked = !core.disabled && editor.state.core;
    $('undo').disabled = !editor.canUndo;
    $('redo').disabled = !editor.canRedo;
    $('new-sentence').disabled = editor.direction !== 'abcde' || !editor.text || editor.text.endsWith('\n') || Array.from(editor.text).length >= API.maxInput;
    $('clear').disabled = !editor.text;
    previewWords();
    const oldNotice = $('stale-note');
    if (oldNotice) oldNotice.remove();
    if (!editor.text) {
      result.replaceChildren(...initial.map(node => node.cloneNode(true)));
      lastParsed = null;
    } else if (lastParsed !== null && lastParsed !== signature()) {
      const notice = p('入力を変更しました。下は前回の結果です。「読みを確認」で更新できます。', 'notice');
      notice.id = 'stale-note';
      result.prepend(notice);
    }
  }
  function edit(action, message) {
    const changed = action();
    sync();
    $('edit-message').textContent = changed ? message : '';
    return changed;
  }
  function add(value, sentence, label) {
    if (!edit(() => editor.append(value, sentence), label + (sentence ? 'を一文追加しました。' : 'を追加しました。'))) {
      $('edit-message').textContent = '8192文字を超えるため追加できません。今の入力はそのまま残しています。';
    }
  }
  function sampleButton(text, abcde) {
    const button = el('button', 'sample', text);
    button.type = 'button';
    button.title = abcde + ' を新しい一文として追加';
    button.addEventListener('click', () => {
      add(abcde, true, text);
    });
    return button;
  }
  for (const [direction, id] of [['ja', 'want_water'], ['ja', 'help_unspecified'], ['ja', 'do_not_eat'],
    ['en', 'i_want_water'], ['abcde', 'ambiguous_roles'], ['abcde', 'return_three_days']]) {
    const example = DATA.examples.find(example => example.id === id);
    $('samples').append(sampleButton(direction === 'abcde' ? example.abcde : example.reverse[direction][0], example.abcde));
  }
  for (const direction of ['ja', 'en']) {
    const buttons = el('div', 'samples');
    for (const example of DATA.examples) for (const alias of example.reverse[direction]) {
      const button = sampleButton(alias, example.abcde);
      button.classList.add('compact');
      buttons.append(button);
    }
    $('phrases').append(el('h3', '', direction === 'ja' ? '日本語' : 'English'), buttons);
  }
  let category = 'all';
  function showWords() {
    const query = $('word-search').value.trim().toLowerCase();
    $('words').replaceChildren();
    let count = 0;
    for (const [word, entry] of Object.entries(DATA.language.conventions)) {
      const atoms = API.atomize(word);
      const kind = DATA.language.grammar.predicate_heads.includes(atoms[atoms.length - 1]) ? 'predicate' : 'entity';
      const ja = entry.readings.map(r => r.ja).join(' / '), en = entry.readings.map(r => r.en).join(' / ');
      if ((category !== 'all' && category !== kind) || ![word, ja, en].join(' ').toLowerCase().includes(query)) continue;
      const button = el('button', 'word-card', el('span', 'word-ja', ja), el('span', 'english', en), code(word));
      button.type = 'button';
      button.dataset.word = word;
      button.title = entry.note.ja + ' / ' + entry.note.en;
      button.addEventListener('click', () => add(word, false, ja));
      $('words').append(button);
      count++;
    }
    $('word-count').textContent = count + ' / ' + Object.keys(DATA.language.conventions).length + ' 語';
    $('no-words').hidden = count !== 0;
  }
  $('word-search').addEventListener('input', showWords);
  for (const button of document.querySelectorAll('[data-category]')) button.addEventListener('click', () => {
    category = button.dataset.category;
    for (const filter of document.querySelectorAll('[data-category]')) filter.setAttribute('aria-pressed', String(filter === button));
    showWords();
  });
  input.addEventListener('input', () => { editor.setText(input.value); sync(); $('edit-message').textContent = ''; });
  input.addEventListener('blur', () => editor.breakTyping());
  input.addEventListener('compositionstart', () => editor.breakTyping());
  input.addEventListener('compositionend', () => editor.breakTyping());
  form.addEventListener('submit', event => { event.preventDefault(); editor.breakTyping(); translate(); });
  source.addEventListener('change', () => edit(() => editor.setSource(source.value), 'この方向の下書きを表示しています。'));
  core.addEventListener('change', () => edit(() => editor.setCore(core.checked), '表示方法を変更しました。「読みを確認」で更新できます。'));
  $('mode-build').addEventListener('click', () => edit(() => editor.setMode('build'), '組み立て中の文章を表示しています。手入力の下書きは保持しています。'));
  $('mode-manual').addEventListener('click', () => edit(() => editor.setMode('manual'), '手入力の下書きを表示しています。組み立て中の文章は保持しています。'));
  $('undo').addEventListener('click', () => edit(() => editor.undo(), '直前の編集を取り消しました。'));
  $('redo').addEventListener('click', () => edit(() => editor.redo(), '取り消した編集をやり直しました。'));
  $('new-sentence').addEventListener('click', () => edit(() => editor.newSentence(), '次の文に区切りました。'));
  $('clear').addEventListener('click', () => {
    edit(() => editor.clear(), 'この欄をクリアしました。「取り消し」で戻せます。');
  });
  form.addEventListener('keydown', event => {
    if (event.target === $('word-search') || event.isComposing || !(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && !(event.ctrlKey && key === 'y')) return;
    event.preventDefault();
    if (event.shiftKey || key === 'y') edit(() => editor.redo(), '取り消した編集をやり直しました。');
    else edit(() => editor.undo(), '直前の編集を取り消しました。');
  });
  $('version').textContent = '言語仕様 ' + DATA.language.version;
  $('translate').disabled = false;
  $('mode-build').disabled = false;
  $('mode-manual').disabled = false;
  showWords();
  sync();
  $('loading').hidden = true;
})();
