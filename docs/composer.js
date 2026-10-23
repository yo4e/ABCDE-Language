/* Editing state only. Language meanings remain in the shared data/engine.
 * Drafts and undo/redo live in memory until this page is reloaded or closed.
 */
(() => {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  class Editor {
    constructor(maxInput, historyLimit = 100) {
      this.maxInput = maxInput;
      this.historyLimit = historyLimit;
      this.state = { mode: 'build', source: 'ja', core: false,
        drafts: { build: '', ja: '', en: '', abcde: '' } };
      this.past = [];
      this.future = [];
      this.typing = false;
    }
    get key() { return this.state.mode === 'build' ? 'build' : this.state.source; }
    get text() { return this.state.drafts[this.key]; }
    get direction() { return this.state.mode === 'build' ? 'abcde' : this.state.source; }
    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }
    change(update, typing = false) {
      const before = copy(this.state), next = copy(this.state);
      update(next);
      if (JSON.stringify(next) === JSON.stringify(before)) return false;
      if (!typing || !this.typing) {
        this.past.push(before);
        if (this.past.length > this.historyLimit) this.past.shift();
      }
      this.state = next;
      this.future = [];
      this.typing = typing;
      return true;
    }
    setText(text) { return this.change(state => { state.drafts[this.key] = text; }, true); }
    breakTyping() { this.typing = false; }
    setMode(mode) {
      if (!['build', 'manual'].includes(mode)) throw new Error('Unknown editor mode');
      return this.change(state => { state.mode = mode; });
    }
    setSource(source) {
      if (!['ja', 'en', 'abcde'].includes(source)) throw new Error('Unknown input direction');
      return this.change(state => { state.source = source; });
    }
    setCore(core) { return this.change(state => { state.core = core; }); }
    append(value, sentence = false) {
      const current = this.state.drafts.build;
      const separator = !current || current.endsWith('\n') ? '' : sentence ? '\n' : current.endsWith(' ') ? '' : ' ';
      const next = current + separator + value;
      if (Array.from(next).length > this.maxInput) return false;
      return this.change(state => { state.mode = 'build'; state.drafts.build = next; });
    }
    newSentence() {
      if (!this.text || this.text.endsWith('\n') || Array.from(this.text).length >= this.maxInput) return false;
      return this.change(state => { state.drafts[this.key] += '\n'; });
    }
    clear() { return this.change(state => { state.drafts[this.key] = ''; }); }
    undo() {
      if (!this.canUndo) return false;
      this.future.push(copy(this.state));
      this.state = this.past.pop();
      this.typing = false;
      return true;
    }
    redo() {
      if (!this.canRedo) return false;
      this.past.push(copy(this.state));
      this.state = this.future.pop();
      this.typing = false;
      return true;
    }
  }
  globalThis.ABCDEComposer = Object.freeze({ Editor });
})();
