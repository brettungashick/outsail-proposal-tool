import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const vendorIdsParam = searchParams.get('vendorIds');
  const minHeadcount = parseInt(searchParams.get('minHeadcount') || '0') || 0;
  const maxHeadcount = parseInt(searchParams.get('maxHeadcount') || '0') || 0;
  const months = parseInt(searchParams.get('months') || '12') || 12;

  const allVendors = await prisma.vendor.findMany();
  const vendorMap = new Map(allVendors.map((v) => [v.name.toLowerCase(), v]));

  let filterVendorNames: string[] = [];
  if (vendorIdsParam) {
    const selectedIds = vendorIdsParam.split(',').map((id) => id.trim());
    filterVendorNames = allVendors
      .filter((v) => selectedIds.includes(v.id))
      .map((v) => v.name.toLowerCase());
  }

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  // All advisors can see benchmarks from all completed projects
  const ownerFilter = {};

  const projects = await prisma.project.findMany({
    where: {
      status: 'complete',
      updatedAt: { gte: cutoffDate },
      ...ownerFilter,
    },
    include: {
      advisor: { select: { name: true } },
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

      if (filterVendorNames.length > 0) {
        const hasMatch = vendors.some((v) =>
          filterVendorNames.some((fv) => v.toLowerCase() === fv)
        );
        if (!hasMatch) return null;
      }

      if (minHeadcount && headcount && headcount < minHeadcount) return null;
      if (maxHeadcount && headcount && headcount > maxHeadcount) return null;

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

      const vendorsEnriched = vendors.map((v) => {
        const vendorObj = vendorMap.get(v.toLowerCase());
        return {
          name: v,
          logoUrl: vendorObj?.logoUrl || null,
          accentColor: vendorObj?.accentColor || null,
        };
      });

      return {
        projectId: p.id,
        projectName: p.name,
        clientName: p.clientName,
        advisorName: p.advisor.name,
        date: p.updatedAt,
        vendors: vendorsEnriched,
        headcount,
        year1Totals,
        total3yr,
      };
    })
    .filter(Boolean);

  return NextResponse.json(results);
}
