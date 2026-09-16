export function parseResponse(value) {
  if (!value || typeof value.answer !== 'string' || !value.answer.trim()) {
    throw new TypeError('Assistant response needs an answer');
  }
  const sources = value.citations ?? [];
  if (!Array.isArray(sources)) throw new TypeError('Citations must be a list');

  const citations = [];
  for (const source of sources) {
    if (!source || typeof source.title !== 'string' || typeof source.url !== 'string') {
      throw new TypeError('Citation needs a title and URL');
    }
    let url;
    try {
      url = new URL(source.url);
    } catch {
      continue;
    }
    if (!['https:', 'http:'].includes(url.protocol)) continue;
    citations.push({ title: source.title, url: url.href });
  }
  return { answer: value.answer, citations };
}
