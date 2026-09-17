export interface HostOptions {
  host?: string;
  user?: string;
  port?: string;
  identity?: string;
}

export interface HostEntry extends HostOptions {
  alias: string;
}

export type Change =
  | { kind: 'add'; alias: string; options: HostOptions }
  | { kind: 'set'; alias: string; options: HostOptions }
  | { kind: 'rename'; alias: string; to: string }
  | { kind: 'remove'; alias: string };

const directives = {
  host: 'HostName', user: 'User', port: 'Port', identity: 'IdentityFile',
} as const;
const plainAlias = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function parseLine(raw: string) {
  const line = raw.replace(/\r?\n$/, '');
  let quote = '';
  let commentAt = line.length;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '\\') { i++; continue; }
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '#') {
      commentAt = i;
      break;
    }
  }
  const body = line.slice(0, commentAt).trim();
  const match = /^([a-zA-Z][a-zA-Z0-9]*)[\t =]+(.+)$/.exec(body);
  return {
    key: match?.[1].toLowerCase(),
    value: match?.[2].trim() ?? '',
    comment: line.slice(commentAt),
    invalid: Boolean(body && (!match || quote)),
  };
}

function document(text: string) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const rows = lines.map(parseLine);
  const sections: { start: number; end: number; names: string[] }[] = [];
  rows.forEach((row, index) => {
    if (row.key !== 'host' && row.key !== 'match') return;
    const previous = sections.at(-1);
    if (previous) previous.end = index;
    sections.push({ start: index, end: rows.length, names: row.key === 'host' ? row.value.split(/\s+/) : [] });
  });
  return { lines, rows, sections };
}

function unquote(value: string) {
  return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

export function listHosts(text: string): HostEntry[] {
  const { rows, sections } = document(text);
  return sections.flatMap(({ start, end, names }) => {
    if (names.length !== 1 || !plainAlias.test(names[0])) return [];
    const entry: HostEntry = { alias: names[0] };
    for (const [option, directive] of Object.entries(directives)) {
      const row = rows.slice(start + 1, end).find((row) => row.key === directive.toLowerCase());
      if (row) entry[option as keyof HostOptions] = unquote(row.value);
    }
    return [entry];
  });
}

function validateAlias(alias: string) {
  if (!plainAlias.test(alias)) throw new Error('Use a single host alias containing letters, digits, dots, underscores or hyphens.');
}

function optionLines(options: HostOptions) {
  return Object.entries(options).map(([option, value]) => {
    if (!(option in directives) || typeof value !== 'string' || !value) {
      throw new Error(`Invalid option: ${option}`);
    }
    if (option === 'port') {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
        throw new Error('Port must be an integer from 1 to 65535.');
      }
    } else if (option === 'identity') {
      if (/[\r\n"\\\0]/.test(value)) throw new Error('Identity path contains unsupported characters.');
    } else if (!/^[a-zA-Z0-9_.:@%-]+$/.test(value)) {
      throw new Error(`Invalid ${option}: ${value}`);
    }
    const encoded = option === 'identity' ? `"${value}"` : value;
    return { key: directives[option as keyof HostOptions], value: encoded };
  });
}

export function updateConfig(text: string, change: Change): string {
  validateAlias(change.alias);
  const { lines, rows, sections } = document(text);
  if (rows.some((row) => row.invalid)) throw new Error('Cannot edit this config: unrecognized directive syntax.');
  if (rows.some((row) => row.key === 'include' || row.key === 'match')) {
    throw new Error('Configs containing Include or Match must be edited by hand.');
  }
  if (rows.some((row) => row.key === 'host' && /["'\\]/.test(row.value))) {
    throw new Error('Quoted or escaped Host patterns must be edited by hand.');
  }
  const matching = (alias: string) => sections.filter((section) =>
    section.names.some((name) => name.toLowerCase() === alias.toLowerCase()),
  );
  const matches = matching(change.alias);
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const withComment = (index: number, body: string) => {
    const suffix = rows[index].comment ? ` ${rows[index].comment}` : '';
    const ending = lines[index].endsWith('\n') ? (lines[index].endsWith('\r\n') ? '\r\n' : '\n') : '';
    return body + suffix + ending;
  };

  if (change.kind === 'add') {
    if (matches.length) throw new Error(`Host already exists: ${change.alias}`);
    if (!change.options.host) throw new Error('A hostname is required when adding a host.');
    const options = optionLines(change.options);
    const separator = !text ? '' : text.endsWith('\n') ? newline : newline + newline;
    const block = `Host ${change.alias}${newline}` +
      options.map(({ key, value }) => `  ${key} ${value}${newline}`).join('');
    // OpenSSH takes the first value it finds; specific hosts precede defaults.
    const defaults = sections.find((section) => section.names.some((name) => /[*?!]/.test(name)));
    if (defaults) {
      lines.splice(defaults.start, 0, block + newline);
      return lines.join('');
    }
    return text + separator + block;
  }

  if (!matches.length) throw new Error(`Host not found: ${change.alias}`);
  if (matches.length !== 1 || matches[0].names.length !== 1) {
    throw new Error(`Host is repeated or belongs to a multi-alias block: ${change.alias}`);
  }
  const section = matches[0];
  let end = section.end;
  // Leave trailing comments in place: they often describe the next host.
  while (end > section.start + 1 && !rows[end - 1].key) end--;

  if (change.kind === 'remove') {
    lines.splice(section.start, end - section.start);
  } else if (change.kind === 'rename') {
    validateAlias(change.to);
    const collisions = matching(change.to).filter((candidate) => candidate !== section);
    if (collisions.length) throw new Error(`Host already exists: ${change.to}`);
    const indent = /^\s*/.exec(lines[section.start])![0];
    lines[section.start] = withComment(section.start, `${indent}Host ${change.to}`);
  } else {
    const options = optionLines(change.options);
    if (!options.length) throw new Error('Choose at least one option to change.');
    const added: string[] = [];
    for (const { key, value } of options) {
      const indices = rows.flatMap((row, index) =>
        index > section.start && index < end && row.key === key.toLowerCase() ? [index] : [],
      );
      if (indices.length > 1) throw new Error(`Repeated ${key} directives must be edited by hand.`);
      if (indices.length) {
        const index = indices[0];
        const indent = /^[\t ]*/.exec(lines[index])![0];
        lines[index] = withComment(index, `${indent}${key} ${value}`);
      } else {
        added.push(`  ${key} ${value}${newline}`);
      }
    }
    if (added.length) {
      if (!lines[end - 1].endsWith('\n')) lines[end - 1] += newline;
      lines.splice(end, 0, ...added);
    }
  }
  return lines.join('');
}
