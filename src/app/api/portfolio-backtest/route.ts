import { NextRequest, NextResponse } from 'next/server';
import { runRollingBacktest } from '@/lib/backtest/rollingBacktestEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rebalancingParam = (searchParams.get('rebalancing') ?? 'MONTHLY').toUpperCase();
  const rebalancing = rebalancingParam === 'QUARTERLY' ? 'QUARTERLY' : 'MONTHLY';

  const universeSize = Math.max(10, Math.min(40, Number(searchParams.get('universe') ?? 24)));
  const maxWindows = Math.max(1, Math.min(4, Number(searchParams.get('windows') ?? 2)));

  try {
    const result = await runRollingBacktest({
      rebalancing,
      universeSize,
      maxWindows,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown rolling backtest error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
