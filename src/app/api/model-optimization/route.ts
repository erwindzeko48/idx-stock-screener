import { NextResponse } from 'next/server';
import { runModelOptimizationReport } from '@/lib/analysis/modelOptimizationEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = await runModelOptimizationReport();
    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Model optimization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
