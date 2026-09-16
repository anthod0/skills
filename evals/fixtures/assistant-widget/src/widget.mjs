import { widgetCss } from './styles.mjs';

export { widgetCss };

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function renderWidget(state, draft = '') {
  const busy = state.status === 'sending';
  const disabled = busy || !draft.trim();
  const transcript = state.turns.map((turn) => {
    const citations = turn.citations.map((source) =>
      `<a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>`,
    ).join('');
    return `<li><p>${escapeHtml(turn.question)}</p><p>${escapeHtml(turn.answer)}</p>${citations}</li>`;
  }).join('');
  const error = state.error ? `<p role="alert">${escapeHtml(state.error)}</p>` : '';

  return `<style>${widgetCss}</style>
<section class="assistant-panel support-widget" aria-busy="${busy}">
  <h2>Ask support</h2>
  <ol class="assistant-transcript">${transcript}</ol>
  ${error}
  <button type="button" class="assistant-submit"${disabled ? ' disabled' : ''}>Send question</button>
</section>`;
}
