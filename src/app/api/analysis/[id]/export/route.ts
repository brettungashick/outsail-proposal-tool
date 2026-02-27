import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateExcelBuffer } from '@/lib/export-excel';
import { generatePdfBuffer } from '@/lib/export-pdf';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const format = req.nextUrl.searchParams.get('format') || 'excel';

  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const comparisonData = JSON.parse(analysis.comparisonData);
  const standardizationNotes = analysis.standardizationNotes
    ? JSON.parse(analysis.standardizationNotes)
    : [];
  const vendorNotes = analysis.vendorNotes ? JSON.parse(analysis.vendorNotes) : {};
  const nextSteps = analysis.nextSteps ? JSON.parse(analysis.nextSteps) : [];
  const citations = analysis.citations ? JSON.parse(analysis.citations) : [];
  const projectName = analysis.project.name;

  try {
    if (format === 'pdf') {
      const buffer = generatePdfBuffer(
        comparisonData,
        standardizationNotes,
        vendorNotes,
        nextSteps,
        citations,
        projectName
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${projectName} - Comparison.pdf"`,
        },
      });
    } else {
      const buffer = generateExcelBuffer(
        comparisonData,
        standardizationNotes,
        vendorNotes,
        nextSteps,
        citations,
        projectName
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${projectName} - Comparison.xlsx"`,
        },
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
