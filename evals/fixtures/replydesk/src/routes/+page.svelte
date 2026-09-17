<script lang="ts">
  import { enhance } from '$app/forms';
  import { inputLimits, toneLabels } from '$lib/reply';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
  let pending = $state(false);
  let transportError = $state('');
  let copyStatus = $state('');
  const draft = $derived(form?.draft ?? '');

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      copyStatus = 'Copied to clipboard.';
    } catch {
      copyStatus = 'Couldn’t access the clipboard. Select the draft and copy it manually.';
    }
  }
</script>

<svelte:head>
  <title>Replydesk — Customer reply drafts</title>
  <meta name="description" content="Turn a customer message and the facts you know into a thoughtful reply draft." />
</svelte:head>

<div class="workspace">
  <header class="site-header">
    <a class="brand" href="/" aria-label="Replydesk home">
      <span class="brand-mark" aria-hidden="true">r.</span>
      Replydesk
    </a>
    <span class="header-note">A little help with the right words</span>
  </header>

  <main>
    <div class="intro">
      <p class="eyebrow">Customer support, considered</p>
      <h1>A clear reply starts with the facts.</h1>
      <p>Bring the context. Get a draft to review and copy into your support inbox.</p>
    </div>

    <div class="editor-grid">
      <section class="panel" aria-labelledby="request-heading">
        <div class="panel-heading">
          <span class="step" aria-hidden="true">01</span>
          <div>
            <h2 id="request-heading">The conversation</h2>
            <p>What does your customer need?</p>
          </div>
        </div>

        <form method="POST" use:enhance={({ cancel }) => {
          if (pending) { cancel(); return; }
          pending = true;
          transportError = '';
          copyStatus = '';
          return async ({ result, update }) => {
            try {
              if (result.type === 'error') {
                transportError = 'The request didn’t finish. Your notes are still here — try again.';
              } else {
                await update({ reset: false });
              }
            } finally {
              pending = false;
            }
          };
        }}>
          <fieldset class="input-fields" disabled={pending}>
            <div class="field">
              <label for="message">Customer message</label>
              <textarea
                id="message" name="message" rows="6" required
                maxlength={inputLimits.message}
                placeholder="My order was supposed to arrive yesterday. Can you tell me where it is?"
                value={form?.values.message ?? ''}
                aria-invalid={Boolean(form?.errors.message)}
                aria-describedby={form?.errors.message ? 'message-error' : undefined}
              ></textarea>
              {#if form?.errors.message}<p class="field-error" id="message-error">{form.errors.message}</p>{/if}
            </div>

            <div class="field">
              <label for="context">What you know <span class="optional">Optional</span></label>
              <p class="hint" id="context-hint">Confirmed facts, what you can offer, and any details to avoid sharing.</p>
              <textarea
                id="context" name="context" rows="4"
                maxlength={inputLimits.context}
                placeholder="Carrier reports a weather delay. Current estimate is Friday. We can refund the shipping fee if it misses that date."
                value={form?.values.context ?? ''}
                aria-invalid={Boolean(form?.errors.context)}
                aria-describedby={form?.errors.context ? 'context-hint context-error' : 'context-hint'}
              ></textarea>
              {#if form?.errors.context}<p class="field-error" id="context-error">{form.errors.context}</p>{/if}
            </div>

            <fieldset class="tone-field" aria-describedby={form?.errors.tone ? 'tone-error' : undefined}>
              <legend>Reply tone</legend>
              <div class="tone-options">
                {#each Object.entries(toneLabels) as [tone, label] (tone)}
                  <label class="tone-option">
                    <input type="radio" name="tone" value={tone} checked={(form?.values.tone ?? 'friendly') === tone} />
                    <span>{label}</span>
                  </label>
                {/each}
              </div>
              {#if form?.errors.tone}<p class="field-error" id="tone-error">{form.errors.tone}</p>{/if}
            </fieldset>

            <button class="primary-button" type="submit">
              {pending ? 'Writing your draft…' : 'Generate reply'}
              <span aria-hidden="true">↗</span>
            </button>
          </fieldset>
          {#if transportError || form?.error}
            <p class="request-error" role="alert">{transportError || form?.error}</p>
          {/if}
          <p class="privacy-note">Submitted text is sent to OpenAI. Leave out passwords and sensitive customer details.</p>
        </form>
      </section>

      <section class="panel draft-panel" aria-labelledby="draft-heading" aria-busy={pending}>
        <div class="panel-heading">
          <span class="step" aria-hidden="true">02</span>
          <div>
            <h2 id="draft-heading">Your reply draft</h2>
            <p>One last read before you send.</p>
          </div>
        </div>
        <div class="draft-content" aria-live="polite">
          {#if pending}
            <div class="empty-state"><span class="draft-symbol" aria-hidden="true">…</span><p>Finding the right words…</p></div>
          {:else if draft}
            <div class="reply-text">{draft}</div>
          {:else}
            <div class="empty-state">
              <span class="draft-symbol" aria-hidden="true">↳</span>
              <h3>A starting point, not an autopilot.</h3>
              <p>Your draft will appear here. Check the details and make it sound like you.</p>
            </div>
          {/if}
        </div>
        <div class="draft-footer">
          <span>Review facts and commitments before sending.</span>
          <button class="secondary-button" type="button" disabled={!draft || pending} onclick={copyDraft}>Copy draft</button>
        </div>
        <p class="copy-status" role="status">{copyStatus}</p>
        <noscript><p class="hint">Select the draft text to copy it. The copy button needs JavaScript.</p></noscript>
      </section>
    </div>
  </main>
  <footer class="site-footer">A thoughtful reply goes a long way.</footer>
</div>
