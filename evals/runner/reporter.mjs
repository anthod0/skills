function describeError(error) {
  if (!error) return undefined;
  return {
    code: error.code, message: error.message, failureType: error.failureType,
    cause: error.cause ? describeError(error.cause) : undefined,
  };
}

export default async function* reporter(source) {
  for await (const { type, data } of source) {
    if (type === 'test:pass' || type === 'test:fail') {
      yield JSON.stringify({
        type, name: data.name, file: data.file, skip: data.skip, todo: data.todo,
        subtype: data.details?.type, error: describeError(data.details?.error),
      }) + '\n';
    } else if (type === 'test:summary' && !data.file) {
      yield JSON.stringify({ type, counts: data.counts }) + '\n';
    } else if (type === 'test:stdout' || type === 'test:stderr') {
      yield JSON.stringify({ type, message: data.message }) + '\n';
    }
  }
}
