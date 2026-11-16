import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services/aiService';

export async function POST(req: NextRequest) {
  try {
    const { type, fileBase64, url } = await req.json();

    if (type === 'pdf') {
      if (!fileBase64) {
        return NextResponse.json({ error: 'fileBase64 is required for PDF parsing' }, { status: 400 });
      }
      const text = await aiService.parsePdfText(fileBase64);
      return NextResponse.json({ success: true, text });
    }

    if (type === 'docx') {
      if (!fileBase64) {
        return NextResponse.json({ error: 'fileBase64 is required for DOCX parsing' }, { status: 400 });
      }
      const text = await aiService.parseDocxText(fileBase64);
      return NextResponse.json({ success: true, text });
    }

    if (type === 'txt') {
      if (!fileBase64) {
        return NextResponse.json({ error: 'fileBase64 is required for TXT parsing' }, { status: 400 });
      }
      const text = await aiService.parseTxtText(fileBase64);
      return NextResponse.json({ success: true, text });
    }

    if (type === 'audio' || type === 'voice') {
      if (!fileBase64) {
        return NextResponse.json({ error: 'fileBase64 is required for audio transcription' }, { status: 400 });
      }
      const result = await aiService.transcribeAudio(fileBase64, url || 'audio/webm');
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to transcribe audio' }, { status: 500 });
      }
      return NextResponse.json({ success: true, text: result.text });
    }

    if (type === 'link') {
      if (!url || typeof url !== 'string' || !url.trim()) {
        return NextResponse.json({ error: 'A valid webpage URL is required for link ingestion' }, { status: 400 });
      }
      const result = await aiService.fetchLinkContent(url.trim());
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Could not extract readable article text. You can paste the text manually.' },
          { status: 422 }
        );
      }
      return NextResponse.json({
        success: true,
        title: result.title,
        text: result.content,
        summary: result.summary,
        takeaways: result.takeaways,
        tags: result.tags
      });
    }

    return NextResponse.json({ error: 'Invalid ingestion type. Supported types: pdf, docx, txt, audio, voice, link' }, { status: 400 });
  } catch (error: any) {
    const errStr = error?.message || String(error);
    console.error('[API /api/ingest] Server Technical Error:', errStr);

    let userFacingError = 'Failed to extract text from document. Please ensure the file is a valid, readable document.';
    if (errStr.includes('PDF') || errStr.includes('DOCX') || errStr.includes('TXT')) {
      userFacingError = errStr;
    } else if (errStr.includes('URL') || errStr.includes('webpage') || errStr.includes('restricted') || errStr.includes('readable') || errStr.includes('timed out')) {
      userFacingError = errStr;
    }

    return NextResponse.json(
      { error: userFacingError },
      { status: 500 }
    );
  }
}
