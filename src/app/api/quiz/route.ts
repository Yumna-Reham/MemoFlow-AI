import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services/aiService';

export async function POST(req: NextRequest) {
  try {
    const { title, content, numQuestions, difficulty } = await req.json();

    if (!title && !content) {
      return NextResponse.json({ error: 'Title or content is required to generate quiz.' }, { status: 400 });
    }

    const count = typeof numQuestions === 'number' ? numQuestions : parseInt(numQuestions) || 5;
    const diff = typeof difficulty === 'string' ? difficulty : 'medium';

    const quiz = await aiService.generateQuiz(title, content, count, diff);
    if (!quiz || quiz.length === 0) {
      return NextResponse.json({
        error: 'Quiz generation is temporarily unavailable. Please try again.'
      }, { status: 503 });
    }

    return NextResponse.json({ success: true, quiz });
  } catch (error: any) {
    console.error('[API /api/quiz] Error:', error);
    return NextResponse.json({
      error: 'Quiz generation is temporarily unavailable. Please try again.'
    }, { status: 500 });
  }
}
