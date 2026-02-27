import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const vendorsParam = searchParams.get('vendors'); // comma-separated
  const minHeadcount = parseInt(searchParams.get('minHeadcount') || '0') || 0;
  const maxHeadcount = parseInt(searchParams.get('maxHeadcount') || '0') || 0;
  const months = parseInt(searchParams.get('months') || '12') || 12;

  // Get all completed projects with their latest analysis
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const projects = await prisma.project.findMany({
    where: {
      status: 'complete',
      updatedAt: { gte: cutoffDate },
    },
    include: {
      advisor: { select: { name: true, email: true } },
      analyses: {
        orderBy: { version: 'desc' },
        take: 1,
      },
      documents: {
        select: { vendorName: true },
        distinct: ['vendorName'],
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Filter and extract benchmark data
  const results = projects
    .filter((p) => p.analyses.length > 0)
    .map((p) => {
      const analysis = p.analyses[0];
      let comparisonData;
      try {
        comparisonData = JSON.parse(analysis.comparisonData);
      } catch {
        return null;
      }

      const vendors: string[] = comparisonData.vendors || [];
      const headcount: number | null = comparisonData.normalizedHeadcount || null;

      // Filter by vendors if specified
      if (vendorsParam) {
        const searchVendors = vendorsParam.split(',').map((v) => v.trim().toLowerCase());
        const hasMatch = vendors.some((v) =>
          searchVendors.some((sv) => v.toLowerCase().includes(sv))
        );
        if (!hasMatch) return null;
      }

      // Filter by headcount if specified
      if (minHeadcount && headcount && headcount < minHeadcount) return null;
      if (maxHeadcount && headcount && headcount > maxHeadcount) return null;

      // Extract key totals from Totals section
      const totalsSection = comparisonData.sections?.find(
        (s: { name: string }) => s.name === 'Totals'
      );
      const year1Row = totalsSection?.rows?.find(
        (r: { id: string }) => r.id === 'year1'
      );
      const total3yrRow = totalsSection?.rows?.find(
        (r: { id: string }) => r.id === 'total3yr'
      );

      const year1Totals: Record<string, string> = {};
      const total3yr: Record<string, string> = {};
      if (year1Row) {
        vendors.forEach((v: string, i: number) => {
          year1Totals[v] = year1Row.values[i]?.display || 'N/A';
        });
      }
      if (total3yrRow) {
        vendors.forEach((v: string, i: number) => {
          total3yr[v] = total3yrRow.values[i]?.display || 'N/A';
        });
      }

      return {
        projectId: p.id,
        projectName: p.name,
        clientName: p.clientName,
        advisorName: p.advisor.name,
        date: p.updatedAt,
        vendors,
        headcount,
        year1Totals,
        total3yr,
      };
    })
    .filter(Boolean);

  return NextResponse.json(results);
}
