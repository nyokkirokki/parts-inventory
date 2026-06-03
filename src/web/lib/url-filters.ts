export function toggleSearchParamValue(params: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  const values = next.getAll(key);
  next.delete(key);

  const nextValues = values.includes(value) ? values.filter((currentValue) => currentValue !== value) : [...values, value];
  for (const nextValue of nextValues) next.append(key, nextValue);

  return next;
}

export function clearSearchParamValues(params: URLSearchParams, key: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(key);
  return next;
}
