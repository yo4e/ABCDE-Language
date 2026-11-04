/* UI only: all parsing is in engine.js, all language data comes from data.js. */
(() => {
  'use strict';
  const DATA = globalThis.ABCDE_DATA, API = globalThis.ABCDE;
  const $ = id => document.getElementById(id);
  const form = $('translator'), source = $('source'), input = $('text'), core = $('core-only'), result = $('result');
  const editor = new ABCDEComposer.Editor(API.maxInput);
  let lastParsed = null;
  let lastStatus = '';
  let hasShownResult = false;
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
        const action = el('span', 'disclosure-action');
        action.setAttribute('aria-hidden', 'true');
        const preview = sentence.terms.slice(0, 3).map(term => term.surface + '（アトム：' + (term.atoms.join(' + ') || '外部ラベル') + '）').join(' / ');
        const terms = el('details', 'terms', el('summary', '', '語を分解して見る（直訳・慣用候補）', action,
          el('span', 'terms-preview', preview)));
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
  function syncDock() {
    const lines = editor.text.trimEnd().split('\n');
    const tail = Array.from(lines[lines.length - 1]);
    $('summary-label').textContent = '入力の末尾 · ' + directions[editor.direction];
    $('draft-summary').textContent = editor.text ? (tail.length > 80 ? '…' : '') + tail.slice(-80).join('')
      : 'ことばを選ぶか、入力を編集してください';
    let labelsText = '';
    if (editor.state.mode === 'build') {
      try {
        const words = API.tokenize(lines[lines.length - 1]);
        labelsText = (words.length > 4 ? '… / ' : '') + words.slice(-4).map(word => {
          const entry = Object.prototype.hasOwnProperty.call(DATA.language.conventions, word) ? DATA.language.conventions[word] : null;
          return entry ? entry.readings.map(reading => reading.ja).join('・') : word;
        }).join(' / ');
      } catch { /* Partial manual edits can remain incomplete until confirmation. */ }
    }
    $('draft-words').textContent = labelsText;
    $('draft-words').hidden = !labelsText;
    const state = !editor.text ? 'empty' : lastParsed === null ? 'pending' : lastParsed === signature() ? 'current' : 'stale';
    const labels = { empty: 'まだ入力はありません', pending: '読みは未確認です', current: '現在の入力の結果を表示中', stale: '入力・表示を変更 · 結果は前回のもの' };
    $('result-state').textContent = labels[state];
    $('composer-dock').dataset.state = state;
  }
  function focusResult() {
    if (!hasShownResult) $('reading-guide').open = false;
    hasShownResult = true;
    syncDock();
    result.focus();
    result.scrollIntoView({ block: 'start' });
  }
  function showResult(value, text, direction, coreOnly) {
    result.classList.remove('is-stale');
    const heading = el('h2', '', status[value.status]);
    heading.id = 'result-heading';
    result.replaceChildren(el('div', 'submission', el('span', 'eyebrow', '確認した入力 · ' + directions[direction]), code(text)), heading);
    if (coreOnly) result.append(p('アトムと構文のみ。語・文・時間の慣用候補は表示していません。', 'notice'));
    if (value.matches) {
      result.append(el('div', 'lookup-note', bilingual(value.note)));
      if (!value.matches.length) {
        const link = el('a', '', '使える日本語と英語を開く');
        link.href = '#phrases';
        link.addEventListener('click', event => {
          event.preventDefault();
          const details = document.querySelector('.phrasebook');
          details.open = true;
          details.querySelector('summary').focus();
        });
        result.append(p('登録表現を確認して入力するか、例文を追加してください。近い表現への自動置き換えはしません。'), link);
      }
      for (const match of value.matches) {
        result.append(el('div', 'answer', el('span', 'eyebrow', 'ABCDE'), code(match.abcde)), ...renderAnalysis(match.analysis));
      }
    } else result.append(...renderAnalysis(value));
    $('announcement').textContent = status[value.status];
    lastParsed = signature();
    lastStatus = status[value.status];
    focusResult();
  }
  function translate() {
    const text = editor.text, direction = editor.direction, coreOnly = direction === 'abcde' && editor.state.core;
    if (Array.from(text).length > API.maxInput || !text.trim()) {
      result.classList.remove('is-stale');
      result.replaceChildren(el('h2', '', '入力を確認してください'), p('1〜8192文字を入力するか、語・例文を追加してください。', 'notice'));
      result.querySelector('h2').id = 'result-heading';
      lastStatus = '入力を確認してください';
      lastParsed = signature();
      $('announcement').textContent = '入力を確認してください';
      focusResult();
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
    $('starter').hidden = !building;
    $('go-words').hidden = !building;
    $('workspace').classList.toggle('manual-mode', !building);
    $('text-label').textContent = building ? '組み立てた文章（ABCDE）' : '入力する言葉';
    input.placeholder = building ? '語カードを押すと、ここに追加されます' : '水がほしい / A! CEDA';
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
    $('history-help').textContent = (editor.canUndo ? '直前の編集は「取り消し」で戻せます。' : 'まだ取り消せる編集はありません。')
      + (editor.canRedo ? '取り消した編集は「やり直し」で戻せます。' : '「やり直し」は取り消し後に使えます。新しく編集すると、やり直しの履歴は消えます。');
    $('new-sentence').disabled = editor.direction !== 'abcde' || !editor.text || editor.text.endsWith('\n') || Array.from(editor.text).length >= API.maxInput;
    $('clear').disabled = !editor.text;
    previewWords();
    syncStarter();
    const oldNotice = $('stale-note');
    if (oldNotice) oldNotice.remove();
    if (!editor.text) {
      result.classList.remove('is-stale');
      result.replaceChildren(...initial.map(node => node.cloneNode(true)));
      lastParsed = null;
    }
    const stale = lastParsed !== null && lastParsed !== signature();
    result.classList.toggle('is-stale', stale);
    if ($('result-heading')) $('result-heading').textContent = stale ? '前回の結果 · 現在の入力は未確認です' : lastStatus;
    if (stale) {
      const refresh = el('button', 'refresh-result', '今の入力で読みを確認');
      refresh.type = 'button';
      refresh.addEventListener('click', () => { editor.breakTyping(); translate(); });
      const notice = el('div', 'notice stale-notice', p('入力・表示方法が変わりました。下は前回の結果です。'), refresh);
      notice.id = 'stale-note';
      result.prepend(notice);
    }
    syncDock();
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
    button.dataset.abcde = abcde;
    button.addEventListener('click', () => {
      add(abcde, true, text);
    });
    return button;
  }
  const featured = new Set();
  for (const [direction, id] of [['ja', 'want_water'], ['ja', 'help_unspecified'], ['ja', 'do_not_eat'],
    ['en', 'i_want_water'], ['abcde', 'ambiguous_roles'], ['abcde', 'return_three_days']]) {
    const example = DATA.examples.find(example => example.id === id);
    featured.add(example.abcde);
    $('samples').append(sampleButton(direction === 'abcde' ? example.abcde : example.reverse[direction][0], example.abcde));
  }
  // One action per ABCDE sentence; preserve every accepted spelling as reference text.
  const phrases = new Map();
  for (const example of DATA.examples) {
    if (!example.reverse.ja.length && !example.reverse.en.length) continue;
    if (!phrases.has(example.abcde)) phrases.set(example.abcde, { ja: new Set(), en: new Set() });
    for (const direction of ['ja', 'en']) for (const alias of example.reverse[direction]) phrases.get(example.abcde)[direction].add(alias);
  }
  for (const [abcde, aliases] of phrases) {
    const ja = [...aliases.ja], en = [...aliases.en];
    const row = el('div', 'phrase-row', code(abcde));
    if (featured.has(abcde)) row.append(p('「例文を一文追加」のボタンで追加できます。', 'hint'));
    else row.append(sampleButton([ja[0], en[0]].filter(Boolean).join(' / '), abcde));
    row.append(p('日本語：' + (ja.join(' / ') || '登録なし')), p('English: ' + (en.join(' / ') || '登録なし'), 'english'));
    $('phrases').append(row);
  }
  const starterWords = ['BA', 'BACE', 'ADACA'];
  const starterLabels = ['1 主語：私', '2 述語：欲しい', '3 対象：水'];
  for (const [i, word] of starterWords.entries()) {
    const button = el('button', 'starter-step', el('span', '', starterLabels[i].split('：')[0]),
      el('span', 'starter-word', DATA.language.conventions[word].readings[0].ja), code(word));
    button.type = 'button';
    button.dataset.step = i;
    button.addEventListener('click', () => add(word, false, DATA.language.conventions[word].readings[0].ja));
    $('starter-steps').append(button);
  }
  function syncStarter() {
    // This guide recognizes only this example, never infers roles in arbitrary input.
    const line = editor.text.split('\n').at(-1).trim().replace(/\s+/g, ' ');
    const step = ['', 'BA', 'BA BACE', 'BA BACE ADACA'].indexOf(line);
    for (const button of $('starter-steps').children) {
      if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    $('starter-hint').textContent = step >= 0 && step < 3 ? '次は「' + starterLabels[step] + '」を押してみましょう。'
      : step === 3 ? '3語そろいました。「読みを確認」で直訳と慣用を確かめましょう。'
        : '自由に組み立て中です。「読みを確認」で語順や省略を確認できます。この例を始めるには「次の文へ」を押します。';
  }
  // A small, explicit starting set; every convention remains reachable via All/search.
  const commonWords = ['BA', 'BACE', 'ADACA', 'BE', 'CEDA', 'CECA'];
  let category = 'common';
  function showWords() {
    const query = $('word-search').value.trim().toLowerCase();
    $('words').replaceChildren();
    let count = 0;
    const entries = category === 'common' ? commonWords.map(word => [word, DATA.language.conventions[word]]) : Object.entries(DATA.language.conventions);
    for (const [word, entry] of entries) {
      const atoms = API.atomize(word);
      const kind = DATA.language.grammar.predicate_heads.includes(atoms[atoms.length - 1]) ? 'predicate' : 'entity';
      const ja = entry.readings.map(r => r.ja).join(' / '), en = entry.readings.map(r => r.en).join(' / ');
      if ((!['all', 'common'].includes(category) && category !== kind) || ![word, ja, en].join(' ').toLowerCase().includes(query)) continue;
      const button = el('button', 'word-card', el('span', 'word-ja', ja), el('span', 'english', en), code(word),
        el('span', 'word-note', entry.note.ja));
      button.type = 'button';
      button.dataset.word = word;
      button.title = entry.note.ja + ' / ' + entry.note.en;
      button.addEventListener('click', () => add(word, false, ja));
      $('words').append(button);
      count++;
    }
    $('word-count').textContent = count + ' / ' + Object.keys(DATA.language.conventions).length + ' 語';
    $('word-scope').textContent = category === 'common' ? 'ほかの語は「すべて28語」か検索で探せます。'
      : '表示中の語はページをスクロールして選べます。入力は上の確認バーに残ります。';
    $('no-words').hidden = count !== 0;
    for (const filter of document.querySelectorAll('[data-category]')) filter.setAttribute('aria-pressed', String(filter.dataset.category === category));
  }
  $('word-search').addEventListener('input', () => {
    if (category === 'common' && $('word-search').value.trim()) category = 'all';
    showWords();
  });
  for (const [id, target] of [['go-words', 'word-search'], ['go-input', 'text']]) {
    $(id).addEventListener('click', event => {
      event.preventDefault();
      $(target).focus();
      $(target).scrollIntoView({ block: 'start' });
    });
  }
  for (const button of document.querySelectorAll('[data-category]')) button.addEventListener('click', () => {
    category = button.dataset.category;
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
  $('controls').disabled = false;
  $('controls').setAttribute('aria-busy', 'false');
  $('loading').hidden = true;
})();
