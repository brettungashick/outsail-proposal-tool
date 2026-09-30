// Advisors sometimes paste whole pages of a PDF into an answer. That is a
// legitimate way to supply missing detail, but an unbounded block of source
// text pushes the comparison prompt — and the table the AI writes from it —
// past what a single response can hold. Cap it, and say so in the prompt so
// the AI knows the note was clipped rather than treating it as complete.
const MAX_ANSWER_CHARS = 20000;
const MAX_ADVISOR_CONTEXT_CHARS = 100000;

export function formatAdvisorAnswers(
  answers: Record<string, string>,
  questionsJson: string | null
): string {
  if (!questionsJson || Object.keys(answers).length === 0) return '';

  try {
    const questions = JSON.parse(questionsJson) as Array<{
      id: string;
      question: string;
      vendorName: string | null;
    }>;

    const lines: string[] = ['ADVISOR CLARIFICATIONS AND NOTES:'];
    let budget = MAX_ADVISOR_CONTEXT_CHARS;

    for (const q of questions) {
      const answer = answers[q.id];
      if (!answer || !answer.trim()) continue;
      if (budget <= 0) break;

      let text = answer.trim();
      const limit = Math.min(MAX_ANSWER_CHARS, budget);
      if (text.length > limit) {
        text = `${text.slice(0, limit)}\n[... note truncated — the advisor pasted more text than fits; treat the remainder as unavailable ...]`;
      }
      budget -= Math.min(answer.length, limit);

      const vendor = q.vendorName ? ` [${q.vendorName}]` : '';
      lines.push(`- Q: ${q.question}${vendor}`);
      lines.push(`  A: ${text}`);
    }

    return lines.length > 1 ? lines.join('\n') : '';
  } catch {
    return '';
  }
}
