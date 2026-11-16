import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services/aiService';

export async function POST(req: NextRequest) {
  try {
    let cleanBase64 = '';
    let mimeType = 'image/png';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No image file uploaded' }, { status: 400 });
      }

      mimeType = file.type || 'image/png';
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      cleanBase64 = buffer.toString('base64');
    } else {
      const body = await req.json();
      const { imageBase64, mimeType: bodyMime } = body;

      if (!imageBase64) {
        return NextResponse.json({ error: 'Missing imageBase64 data' }, { status: 400 });
      }

      if (bodyMime) {
        mimeType = bodyMime;
      }

      if (imageBase64.includes(';base64,')) {
        const parts = imageBase64.split(';base64,');
        mimeType = parts[0].replace('data:', '') || mimeType;
        cleanBase64 = parts[1];
      } else {
        cleanBase64 = imageBase64;
      }
    }

    // Detailed Server Logging for Debugging & Enforcing Gemini Vision
    const hasKey = !!process.env.GEMINI_API_KEY;
    console.log("OCR Key Present:", hasKey);
    console.log("Attempting Gemini Vision OCR call...");

    if (!hasKey) {
      return NextResponse.json({
        error: "GEMINI_API_KEY is not defined in server environment (.env.local)."
      }, { status: 400 });
    }

    // Exclusively route OCR operations through centralized aiService
    const result = await aiService.performOCR(cleanBase64, mimeType);

    if (!result.success && result.error) {
      const isQuota = result.error.includes('429') || result.error.toLowerCase().includes('quota') || result.error.includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        return NextResponse.json({
          error: "AI is temporarily unavailable. Please try again in a moment."
        }, { status: 429 });
      }
      return NextResponse.json({
        error: result.error.startsWith('AI') ? result.error : `OCR Notice: ${result.error}`
      }, { status: 500 });
    }

    return NextResponse.json({
      text: result.text,
      engine: result.engine,
      success: result.success
    });

  } catch (error: any) {
    console.error("[MEMOFLOW OCR] Error:", error);
    const errStr = error?.message || String(error);
    const isQuota = errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return NextResponse.json({
        error: "AI is temporarily unavailable. Please try again in a moment."
      }, { status: 429 });
    }

    return NextResponse.json(
      { error: "AI is temporarily unavailable. Please try again in a moment." },
      { status: 500 }
    );
  }
}
