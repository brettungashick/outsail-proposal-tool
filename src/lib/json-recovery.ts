/**
 * Recovering JSON from a language-model response.
 *
 * Kept separate from claude.ts so these pure helpers can be tested without
 * constructing the Anthropic client.
 */

/**
 * Pull the JSON payload out of a model response: strip markdown fences, drop
 * any prose before the opening brace/bracket, and cut anything trailing the
 * top-level value.
 */
export function extractJsonPayload(responseText: string): string {
  let text = responseText.trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const objIndex = text.indexOf('{');
  const arrIndex = text.indexOf('[');
  const candidates = [objIndex, arrIndex].filter((i) => i >= 0);
  if (candidates.length === 0) return text.trim();
  const start = Math.min(...candidates);
  text = text.slice(start);

  // Walk the value so trailing prose ("Let me know if...") is dropped without
  // guessing at the last closing brace, which is wrong for truncated output.
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) return text.slice(0, i + 1);
    }
  }

  return text.trim();
}

/**
 * Best-effort repair of JSON that was cut off mid-generation (the model hit
 * max_tokens). Rewinds to a point where a complete element had just been
 * written, then closes every container that was still open there, so the
 * result is valid JSON containing everything the model finished writing.
 *
 * The rewind deliberately discards a half-written array element — a module or
 * row with only its first field or two is worse than no record at all, because
 * the rest of the pipeline treats its missing fields as real values.
 *
 * Returns null when the text isn't truncated, or when nothing complete was
 * written before the cut.
 */
export function repairTruncatedJson(text: string): string | null {
  interface SafePoint {
    /** Index of the last character to keep. */
    end: number;
    /** Containers still open at that point, outermost first. */
    stack: string[];
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  // Keyed by container depth: where that container's most recent complete
  // element ended. Depth d refers to the container whose closer is stack[d - 1].
  const completedAtDepth = new Map<number, SafePoint>();

  const record = (depth: number, end: number) => {
    if (depth <= 0 || end < 0) return;
    completedAtDepth.set(depth, { end, stack: [...stack] });
  };

  // Once a container closes, what it recorded about its own contents no longer
  // describes anything still open — drop it so a later sibling at the same
  // depth can't inherit a stale, far-earlier cut point.
  const forgetDeeperThan = (depth: number) => {
    Array.from(completedAtDepth.keys()).forEach((recorded) => {
      if (recorded > depth) completedAtDepth.delete(recorded);
    });
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      stack.pop();
      forgetDeeperThan(stack.length);
      // A nested container just closed, completing an element of its parent.
      record(stack.length, i);
    } else if (ch === ',') {
      // The value before the comma is complete; whatever follows may not be.
      record(stack.length, i - 1);
    }
  }

  // Nothing left open means the text wasn't truncated — a different problem.
  if (stack.length === 0) return null;

  // If an array is still open with a partially written element inside it, cut
  // back to that array's last finished element. Outermost such array wins, so
  // every incomplete record nested below it goes too.
  let chosen: SafePoint | null = null;
  for (let depth = 1; depth < stack.length; depth++) {
    if (stack[depth - 1] !== ']') continue;
    const point = completedAtDepth.get(depth);
    if (point) {
      chosen = point;
      break;
    }
  }

  // Otherwise keep as much as was completed (e.g. a root object cut off
  // partway through its keys) by taking the furthest point still standing.
  if (!chosen) {
    Array.from(completedAtDepth.values()).forEach((point) => {
      if (!chosen || point.end > chosen.end) chosen = point;
    });
  }
  if (!chosen || chosen.stack.length === 0) return null;

  return text.slice(0, chosen.end + 1) + [...chosen.stack].reverse().join('');
}
