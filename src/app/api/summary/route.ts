import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services/aiService';

export async function POST(req: NextRequest) {
  try {
    const { title, content, category = 'Personal' } = await req.json();

    const result = await aiService.generateMemoryAnalysis(title, content, category);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/summary] Error:', error);
    return NextResponse.json(
      { error: 'AI is temporarily busy. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
