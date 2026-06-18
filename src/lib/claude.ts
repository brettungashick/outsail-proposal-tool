import Anthropic from '@anthropic-ai/sdk';
import { ParsedProposal, AnalysisResult, ClarifyingQuestion } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export function isApiKeyConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== 'your-anthropic-api-key-here';
}

export async function parseProposal(
  rawText: string,
  vendorName: string,
  documentId: string,
  documentName: string
): Promise<ParsedProposal> {
  const prompt = `You are analyzing an HRIS/HR Tech vendor proposal document from "${vendorName}". Extract all pricing and scope information into a structured JSON format.

CRITICAL RULES:
- NEVER invent or assume data that is not explicitly stated in the document.
- If a value is unclear or missing, use null for numeric fields and "To be confirmed" for text fields.
- If a price range is given (e.g., "$5-$8 PEPM"), record BOTH the min and max values and set isRange to true.
- Extract exact dollar amounts as numbers.
- Note whether fees are monthly, annual, per-employee-per-month (PEPM), per-employee-per-year (PEPY), or flat fee.
- Pay close attention to what modules/services are included vs. what might be add-ons.
- Extract ALL discounts as structured objects with amounts. Look for: volume discounts, first-year discounts, multi-year discounts, waived fees, promotional pricing, percentage discounts, flat dollar discounts.

DOCUMENT TEXT:
---
${rawText}
---

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "vendorName": "${vendorName}",
  "headcount": <number or null if not stated>,
  "contractTermMonths": <number or null>,
  "modules": [
    {
      "name": "<module name as stated in document>",
      "description": "<brief description>",
      "feeAmount": <number or null>,
      "feeType": "<PEPM|PEPY|monthly_flat|annual_flat|one_time|unknown>",
      "isRange": <boolean>,
      "rangeMin": <number or null>,
      "rangeMax": <number or null>,
      "rawText": "<exact relevant text from document>"
    }
  ],
  "implementationItems": [
    {
      "name": "<item name>",
      "amount": <number or null>,
      "feeType": "<one_time|monthly|annual|unknown>",
      "isOneTime": true,
      "isRecurring": false,
      "rawText": "<exact relevant text>",
      "isRange": <boolean>,
      "rangeMin": <number or null>,
      "rangeMax": <number or null>
    }
  ],
  "serviceItems": [
    {
      "name": "<service name>",
      "amount": <number or null>,
      "feeType": "<PEPM|PEPY|monthly_flat|annual_flat|per_event|unknown>",
      "isOneTime": false,
      "isRecurring": true,
      "rawText": "<exact relevant text>",
      "isRange": <boolean>,
      "rangeMin": <number or null>,
      "rangeMax": <number or null>
    }
  ],
  "discounts": [
    {
      "id": "<unique-id like discount_1>",
      "name": "<discount name, e.g. 'First Year Discount', 'Volume Discount'>",
      "amount": <annual dollar amount of the discount as a positive number, or null if unclear>,
      "type": "<percentage|flat|unknown>",
      "percentageValue": <percentage as a number, e.g. 10 for 10%, or null>,
      "rawText": "<exact relevant text from document>",
      "appliesToYear": <null for all years, 1 for first year only, etc.>
    }
  ],
  "notableTerms": ["<notable term or condition>"],
  "unknowns": ["<anything unclear or potentially missing>"]
}`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Parse the JSON response, stripping any markdown code fences
  let cleanText = responseText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed: ParsedProposal = {
    ...JSON.parse(cleanText),
    documentId,
    documentName,
  };

  return parsed;
}

/**
 * Post-AI validation: fix range midpoints, flag PEPM sanity issues,
 * and ensure discount amounts are negative.
 */
function validateAndFixComparison(
  result: AnalysisResult,
  parsedProposals: ParsedProposal[],
  targetHeadcount: number | null
): void {
  const table = result.comparisonTable;

  // Build a lookup of parsed PEPM rates per vendor for sanity checking
  const vendorPepmRates: Record<string, { name: string; annual: number }[]> = {};
  for (const proposal of parsedProposals) {
    const rates: { name: string; annual: number }[] = [];
    const hc = targetHeadcount || proposal.headcount || 100;
    for (const mod of proposal.modules) {
      if (mod.feeType === 'PEPM' && mod.feeAmount !== null) {
        rates.push({ name: mod.name, annual: mod.feeAmount * hc * 12 });
      } else if (mod.isRange && mod.rangeMin !== null && mod.rangeMax !== null) {
        const midpoint = (mod.rangeMin + mod.rangeMax) / 2;
        if (mod.feeType === 'PEPM') {
          rates.push({ name: mod.name, annual: midpoint * hc * 12 });
        }
      }
    }
    vendorPepmRates[proposal.vendorName] = rates;
  }

  for (const section of table.sections) {
    for (const row of section.rows) {
      for (let vi = 0; vi < table.vendors.length; vi++) {
        const val = row.values[vi];
        if (!val) continue;

        // Fix: Ensure discount amounts are negative
        if (row.isDiscount && val.amount !== null && val.amount > 0) {
          val.amount = -val.amount;
          val.display = `-$${Math.abs(val.amount).toLocaleString('en-US')}`;
          if (!val.note) val.note = 'Sign corrected to negative';
        }
      }
    }
  }

  // Log PEPM sanity warnings (server-side only, helps debugging "weird numbers")
  for (let vi = 0; vi < table.vendors.length; vi++) {
    const vendorName = table.vendors[vi];
    const expectedRates = vendorPepmRates[vendorName] || [];
    if (expectedRates.length === 0) continue;

    const softwareSection = table.sections.find(s => s.name === 'Software Fees (Recurring)');
    if (!softwareSection) continue;

    const subtotalRow = softwareSection.rows.find(r => r.isSubtotal);
    if (!subtotalRow || subtotalRow.values[vi]?.amount === null) continue;

    const aiSubtotal = subtotalRow.values[vi].amount!;
    const expectedTotal = expectedRates.reduce((s, r) => s + r.annual, 0);

    // If the AI subtotal is dramatically different from our expected PEPM-based total, log a warning
    if (expectedTotal > 0 && (aiSubtotal < expectedTotal * 0.08 || aiSubtotal > expectedTotal * 13)) {
      console.warn(
        `[PEPM sanity check] ${vendorName}: AI subtotal $${aiSubtotal} vs expected ~$${Math.round(expectedTotal)} ` +
        `(${expectedRates.length} PEPM items × ${targetHeadcount || '?'} employees × 12 months). ` +
        `Possible annualization error.`
      );
    }
  }
}

export async function generateComparison(
  parsedProposals: ParsedProposal[],
  advisorContext?: string
): Promise<AnalysisResult> {
  const vendorNames = parsedProposals.map((p) => p.vendorName);
  const headcounts = parsedProposals
    .map((p) => p.headcount)
    .filter((h): h is number => h !== null);
  const targetHeadcount =
    headcounts.length > 0
      ? (() => {
          headcounts.sort((a, b) => a - b);
          const mid = Math.floor(headcounts.length / 2);
          return headcounts.length % 2 === 0
            ? Math.round((headcounts[mid - 1] + headcounts[mid]) / 2)
            : headcounts[mid];
        })()
      : null;

  const prompt = `You are building a standardized comparison of HRIS/HR Tech vendor proposals for a client evaluation. You have ${parsedProposals.length} parsed proposals from these vendors: ${vendorNames.join(', ')}.

CRITICAL RULES:
- NEVER hallucinate or fill in gaps that are not found in the parsed data below. If something is missing, set amount to null, display to "To be confirmed", and isConfirmed to false.
- When a price range was given (isRange: true), you MUST calculate the midpoint: (rangeMin + rangeMax) / 2, then use that as the base rate for annualization. Example: "$5-$8 PEPM" → midpoint $6.50 PEPM → $6.50 × headcount × 12 = annual amount. Note the range and midpoint in standardizationNotes.
- ${targetHeadcount ? `Normalize all per-employee pricing to ${targetHeadcount} employees. If a vendor quoted a different headcount, scale proportionally and note it.` : 'Headcount was not consistently specified. Note this and use the amounts as-is.'}
- ALL recurring fee amounts MUST be expressed as ANNUAL totals. If a vendor quotes PEPM (per employee per month), multiply: PEPM × headcount × 12. VERIFY YOUR MATH: for example, $10 PEPM × 500 employees × 12 months = $60,000/year (NOT $5,000, NOT $6,000). If a vendor quotes a monthly flat fee, multiply × 12. The "amount" field for every recurring row must be the annual dollar cost. Implementation fees are one-time and should NOT be annualized. Note any PEPM-to-annual or monthly-to-annual conversions in standardizationNotes, showing the calculation (e.g., "$10 PEPM × 500 × 12 = $60,000").
- Do NOT combine or add pricing that isn't explicitly found. Each cell should map to specific data from the proposals.
- Include a "Discounts" section with each vendor's discounts. Mark discount rows with "isDiscount": true. Each discount row should have a unique id starting with "discount_".

PARSED PROPOSALS:
${JSON.stringify(parsedProposals, null, 2)}
${advisorContext ? `\n${advisorContext}\n\nIMPORTANT: Use the advisor's clarifications above to resolve ambiguities, fill in missing data, and adjust your analysis accordingly. The advisor has domain expertise — prioritize their input over assumptions.\n` : ''}
BUILD A COMPARISON with the following structure. Return ONLY valid JSON (no markdown, no explanation):

{
  "comparisonTable": {
    "vendors": ${JSON.stringify(vendorNames)},
    "normalizedHeadcount": ${targetHeadcount || 'null'},
    "sections": [
      {
        "name": "Software Fees (Recurring)",
        "rows": [
          {
            "id": "<unique-id>",
            "label": "<module category>",
            "values": [
              {
                "amount": <number or null>,
                "display": "<MUST be one of exactly 5 states: '$X,XXX' (dollar amount only, NO /yr suffix), 'Included in bundle' (module included but priced elsewhere), 'Not included' (definitely not in this vendor's offering), 'To be confirmed' (unclear if included), or 'Hidden' (included in bundle or removed for standardization)>",
                "note": "<any note about this value, e.g. 'Midpoint of $5-$8 PEPM' or 'Scaled from 100 to ${targetHeadcount} employees' or null>",
                "citation": {
                  "documentId": "<doc id>",
                  "documentName": "<doc name>",
                  "vendorName": "<vendor>",
                  "excerpt": "<relevant text from raw source>"
                },
                "isConfirmed": <boolean - false if "To be confirmed">
              }
            ]
          }
        ]
      },
      {
        "name": "Implementation Fees (One-Time)",
        "rows": [<similar structure>]
      },
      {
        "name": "Service Fees (Recurring)",
        "rows": [<similar structure>]
      },
      {
        "name": "Discounts",
        "rows": [
          {
            "id": "discount_<vendor>_<index>",
            "label": "<discount name>",
            "isDiscount": true,
            "values": [
              {
                "amount": <negative number representing the discount, or null if vendor has no such discount>,
                "display": "<formatted negative $ amount like '-$1,200' or 'N/A'>",
                "note": "<e.g. '10% first-year discount' or null>",
                "citation": <citation object or null>,
                "isConfirmed": <boolean>
              }
            ]
          }
        ]
      },
      {
        "name": "Totals",
        "rows": [
          {"id": "year1_before_discounts", "label": "Year 1 (Before Discounts)", "values": [...], "isSubtotal": true},
          {"id": "year1_discounts", "label": "Year 1 Discounts", "values": [...], "isDiscount": true},
          {"id": "year1", "label": "Year 1 Total (After Discounts)", "values": [...], "isSubtotal": true},
          {"id": "year2", "label": "Year 2 Total", "values": [...], "isSubtotal": true},
          {"id": "year3", "label": "Year 3 Total", "values": [...], "isSubtotal": true},
          {"id": "total3yr", "label": "3-Year Total", "values": [...], "isSubtotal": true}
        ]
      }
    ]
  },
  "standardizationNotes": [
    "<describe each adjustment made for apples-to-apples comparison>"
  ],
  "vendorNotes": {
    "${vendorNames[0]}": ["<vendor-specific discrepancies, gaps, unknowns>"],
    ${vendorNames.slice(1).map((v) => `"${v}": ["<vendor-specific discrepancies, gaps, unknowns>"]`).join(',\n    ')}
  },
  "nextSteps": [
    "<actionable suggestion for the client, e.g. 'Contact VendorX to clarify Y'>"
  ],
  "citations": [
    {
      "documentId": "<doc id>",
      "documentName": "<doc name>",
      "vendorName": "<vendor>",
      "excerpt": "<relevant source text>"
    }
  ]
}

CONSENSUS MODULE CATEGORIES (map vendor modules to these):
- Core HR (bundle: HRIS, time-off, document management, employee self-service, org chart)
- Payroll
- Benefits Administration
- Onboarding
- Time & Attendance
- ATS / Recruiting (include only if at least one vendor has it)
- LMS / Learning (include only if at least one vendor has it)
- Performance Management (include only if at least one vendor has it)
- Compensation Management (include only if at least one vendor has it)

For Software Fees, add a "Software Subtotal" row at the end (isSubtotal: true).
If any module was originally quoted as PEPM, add an informational row AFTER it showing the per-employee rate: set "isPepm": true, label like "↳ $X.XX PEPM", amount to null, display to the PEPM rate string. These PEPM rows are for reference only and excluded from subtotals.

For Implementation Fees, break out into as much detail as possible. Common implementation line items include:
- Total Implementation / Base Implementation Fee
- General Ledger (GL) Integration
- Carrier Feeds / Benefits Carrier Connections
- 401(k) Integration
- Additional Integrations (specify which if known)
- Historical Data Conversion / Data Migration
- Project Management
- Training / Administrator Training
- Open Enrollment Support
Do NOT lump everything into a single "Total Implementation" row if the vendor provides line-item detail. Use "Not included" for items a vendor doesn't offer, "To be confirmed" for unclear items.

For Service Fees, break out into detail. Common recurring service fees include:
- End-of-Year Tax Filing / W-2 Processing
- COBRA Administration
- HSA/FSA Administration
- Managed Services / HR Outsourcing (if applicable)
- Integration Maintenance / Ongoing Support Fees
- ACA Compliance / Reporting
These vary widely — some vendors bundle tax filing into payroll, others charge separately. Use "Included in bundle" when it's part of another fee. Only include rows where at least one vendor has data.

Only include rows where at least one vendor has data.

For Discounts section:
- Include each unique discount found across all vendors.
- Use negative amounts for discounts.
- If a vendor does not have a particular discount, set amount to null and display to "N/A".
- CRITICAL: Classify each discount by timeframe. If the parsed proposal's appliesToYear === 1, or the discount mentions "first year", "one-time", "signing bonus", or "implementation discount", include "Year 1" or "First Year" in the discount row LABEL (e.g., "First Year Discount - 10%") AND in the note field. If the discount is recurring/ongoing, do NOT use year-specific language. This is critical because the system uses keyword detection on labels and notes to filter which discounts apply to Year 2 and Year 3.

For Totals:
- Year 1 (Before Discounts) = Annual Software Subtotal + Annual Service Fees + Implementation Fees
- Year 1 Discounts = Sum of all applicable Year 1 discounts (as negative number)
- Year 1 Total = Year 1 (Before Discounts) + Year 1 Discounts
- Year 2 = Annual Software Subtotal + Annual Service Fees + RECURRING discounts only (exclude first-year-only discounts, no implementation fees)
- Year 3 = Same as Year 2 (recurring costs only, no first-year discounts, no implementation fees)
- 3-Year Total = Year 1 + Year 2 + Year 3

If any component of a total is "To be confirmed", mark the total as "To be confirmed" too and note which components are missing.`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16384,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  let cleanText = responseText.trim();
  // Strip markdown code fences if present
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Extract valid JSON if there's leading/trailing text
  const firstBrace = cleanText.indexOf('{');
  if (firstBrace > 0) {
    cleanText = cleanText.slice(firstBrace);
  }

  // Find the last closing brace to handle truncation or trailing content
  const lastBrace = cleanText.lastIndexOf('}');
  if (lastBrace > 0 && lastBrace < cleanText.length - 1) {
    cleanText = cleanText.slice(0, lastBrace + 1);
  }

  try {
    const result: AnalysisResult = JSON.parse(cleanText);
    validateAndFixComparison(result, parsedProposals, targetHeadcount);
    return result;
  } catch (parseError) {
    console.error('Failed to parse Claude comparison response. Response length:', responseText.length, 'Stop reason:', message.stop_reason);
    if (message.stop_reason === 'max_tokens') {
      throw new Error('The AI response was too long and got cut off. Please try again — the analysis will regenerate.');
    }
    throw parseError;
  }
}

export async function generateClarifyingQuestions(
  parsedProposals: ParsedProposal[]
): Promise<ClarifyingQuestion[]> {
  const vendorNames = parsedProposals.map((p) => p.vendorName);

  const prompt = `You are an expert HRIS/HR Tech proposal analyst reviewing ${parsedProposals.length} parsed vendor proposals from: ${vendorNames.join(', ')}.

Before generating a final comparison, you need to identify any areas of uncertainty, missing data, ambiguities, or assumptions that an experienced advisor should review.

PARSED PROPOSALS:
${JSON.stringify(parsedProposals, null, 2)}

Analyze the proposals and generate clarifying questions. Focus on:

1. **Missing Data**: Key pricing fields that are null or "To be confirmed" — ask if the advisor has this info from emails, calls, or other docs.
2. **Ambiguities**: Pricing that could be interpreted multiple ways (e.g., unclear if a fee is monthly vs annual, per-employee vs flat).
3. **Discrepancies**: Differences between vendors that seem unusual (e.g., one vendor includes a module free that others charge for — is it truly included or missing from their quote?).
4. **Assumptions**: Things the AI would need to assume for the comparison (e.g., headcount normalization, contract term alignment, how to handle price ranges).
5. **General**: Any other observations the advisor should verify before the comparison is finalized.

RULES:
- Generate between 3-8 questions. Focus on the most impactful items.
- Be specific — reference exact vendor names, module names, and dollar amounts.
- Each question should be actionable — the advisor can either provide a concrete answer or confirm the AI's suggested default.
- Do NOT ask generic questions. Every question should be grounded in something specific from the parsed data.
- Sort by importance: missing data and discrepancies first, assumptions last.

Return ONLY valid JSON (no markdown, no explanation) as an array:
[
  {
    "id": "q1",
    "category": "missing_data|ambiguity|discrepancy|assumption|general",
    "vendorName": "<specific vendor name or null if applies to all>",
    "question": "<the question for the advisor>",
    "context": "<brief explanation of why this matters for the comparison>",
    "suggestedDefault": "<what the AI would assume if the advisor skips this, or null>"
  }
]`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  let cleanText = responseText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const questions: ClarifyingQuestion[] = JSON.parse(cleanText);
  return questions;
}
