import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

/**
 * GET /api/playbooks/suggestions
 *
 * Aggregates learning events to find repeated correction patterns
 * that could become playbook rules. Groups by (vendorName, editType,
 * rowLabel, newDisplay/newStatus) and returns patterns with 2+ occurrences.
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const minCount = Math.max(parseInt(searchParams.get('minCount') || '2', 10), 1);
  const vendorName = searchParams.get('vendorName');

  // Fetch non-promoted events (not yet turned into rules)
  const where: Record<string, unknown> = {
    promotedToRuleId: null,
    editType: { in: ['status_change', 'value_change'] },
  };
  if (vendorName) where.vendorName = vendorName;

  const events = await prisma.learningEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  // Group by (vendorName, editType, rowLabel, newDisplay)
  const groups = new Map<string, {
    vendorName: string;
    editType: string;
    rowLabel: string;
    newDisplay: string;
    newStatus: string | null;
    sectionName: string;
    count: number;
    latestAt: string;
    exampleEventIds: string[];
  }>();

  for (const ev of events) {
    const key = `${ev.vendorName}|${ev.editType}|${ev.rowLabel}|${ev.newDisplay}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (ev.createdAt.toISOString() > existing.latestAt) {
        existing.latestAt = ev.createdAt.toISOString();
      }
      if (existing.exampleEventIds.length < 5) {
        existing.exampleEventIds.push(ev.id);
      }
    } else {
      groups.set(key, {
        vendorName: ev.vendorName,
        editType: ev.editType,
        rowLabel: ev.rowLabel,
        newDisplay: ev.newDisplay,
        newStatus: ev.newStatus,
        sectionName: ev.sectionName,
        count: 1,
        latestAt: ev.createdAt.toISOString(),
        exampleEventIds: [ev.id],
      });
    }
  }

  // Filter by minCount and sort by frequency
  const suggestions = Array.from(groups.values())
    .filter((g) => g.count >= minCount)
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(suggestions);
}
