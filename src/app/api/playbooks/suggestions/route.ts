import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

function toVendorKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * GET /api/playbooks/suggestions
 *
 * Aggregates learning events to find repeated correction patterns
 * that could become playbook rules. Groups by (vendorKey, editType,
 * rowId/rowLabel, newDisplay/newStatus) and returns patterns with 3+ occurrences.
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
  const minCount = Math.max(parseInt(searchParams.get('minCount') || '3', 10), 1);
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

  // Group by (vendorKey, editType, rowId, newDisplay) for stable grouping
  const groups = new Map<string, {
    vendorName: string;
    vendorKey: string;
    editType: string;
    rowId: string;
    rowLabel: string;
    newDisplay: string;
    newStatus: string | null;
    sectionName: string;
    count: number;
    latestAt: string;
    exampleEventIds: string[];
  }>();

  for (const ev of events) {
    const vendorKey = ev.vendorKey || toVendorKey(ev.vendorName);
    // Use rowId for stable grouping, fall back to rowLabel for old events
    const stableRowKey = ev.rowId || ev.rowLabel;
    const key = `${vendorKey}|${ev.editType}|${stableRowKey}|${ev.newDisplay}`;
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
        vendorKey,
        editType: ev.editType,
        rowId: ev.rowId,
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
