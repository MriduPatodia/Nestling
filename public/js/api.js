// Thin fetch wrapper. All requests are same-origin JSON; the session lives in an HttpOnly cookie.
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Can\'t reach the server. Check your connection.');
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth')) onUnauthorized();
    throw new ApiError(res.status, data.error || 'Something went wrong.');
  }
  return data;
}

/** POST that streams NDJSON lines. Calls onDelta(text) and resolves with the final {t:'done'} object. */
export async function stream(path, body, onDelta, signal) {
  let res;
  try {
    res = await fetch(path, { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Can\'t reach the server. Check your connection.');
  }
  if (!res.ok) {
    let data = {}; try { data = await res.json(); } catch { /* ignore */ }
    if (res.status === 401) onUnauthorized();
    throw new ApiError(res.status, data.error || 'Something went wrong.');
  }
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '', final = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.t === 'delta') onDelta(msg.text);
      else if (msg.t === 'error') throw new ApiError(502, msg.message);
      else if (msg.t === 'done') final = msg;
    }
  }
  if (!final) throw new ApiError(502, 'The answer was cut off. Try again.');
  return final;
}
