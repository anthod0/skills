import assert from 'node:assert/strict';
import test from 'node:test';
import { renderWidget, widgetCss } from '../src/widget.mjs';

const emptyState = { status: 'idle', error: null, turns: [] };
const disabledButton = /<button\b[^>]*\sdisabled(?:\s|>)/;

test('disables submission for an empty draft', () => {
  for (const draft of ['', ' \n ']) {
    assert.match(renderWidget(emptyState, draft), disabledButton);
  }
});

test('enables submission when a question is ready', () => {
  const html = renderWidget(emptyState, 'Where is my order?');
  assert.match(html, /<button\b/);
  assert.doesNotMatch(html, disabledButton);
  assert.match(html, /\bclass="(?:[^"]*\s)?assistant-panel(?:\s[^"]*)?"/);
  assert.match(html, /class="assistant-panel support-widget"/);
  assert.match(widgetCss, /padding: 16px;/);
  assert.match(widgetCss, /border-radius: 8px;/);
});

test('marks pending requests busy and disables the submit button', () => {
  const html = renderWidget({ ...emptyState, status: 'sending' }, 'Another question');
  assert.match(html, /aria-busy="true"/);
  assert.match(html, disabledButton);
});

test('escapes questions and answers when rendering the transcript', () => {
  const html = renderWidget({ ...emptyState, turns: [{
    question: '<img src=x onerror="alert(1)">',
    answer: '<script>alert(2)</script> & more', citations: [],
  }] });
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt; &amp; more/);
  assert.doesNotMatch(html, /<img|<script/);
});

test('renders source labels and URLs as escaped links', () => {
  const html = renderWidget({ ...emptyState, turns: [{
    question: 'Help', answer: 'See the guide',
    citations: [{ title: 'Guide <one>', url: 'https://help.example.test/?a=1&b=2' }],
  }] });
  assert.match(html, /href="https:\/\/help\.example\.test\/\?a=1&amp;b=2"/);
  assert.match(html, />Guide &lt;one&gt;<\/a>/);
});

test('supports the host theme', () => {
  assert.match(widgetCss, /\.assistant-panel\s*\{(?:[^{};]*;)*\s*color\s*:\s*var\(\s*--assistant-accent\s*[,)]/);
  assert.match(widgetCss, /#336699/);
});

test('keeps the panel stylesheet consistent', () => {
  assert.equal(widgetCss, `.assistant-panel {
  color: var(--assistant-accent, #336699);
  padding: 16px;
  border-radius: 8px;
}
.assistant-transcript {
  list-style: none;
  margin: 0;
}
.assistant-submit {
  border: 0;
}`);
});
