import { GoogleGenerativeAI } from '@google/generative-ai';
import { Note } from '@/mockData';

export interface AISummaryResult {
  summary: string;
  takeaways: string[];
  suggestedTags: string[];
  extractedTasks: string[];
}

export interface OCROutput {
  text: string;
  engine: 'gemini' | 'tesseract' | 'fallback';
  success: boolean;
  error?: string;
}

export interface LinkContentResult {
  title: string;
  content: string;
  success: boolean;
  error?: string;
  summary?: string;
  takeaways?: string[];
  tags?: string[];
}

// Centralized Model Configuration (Using high-speed active API model endpoint)
const PRIMARY_MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

// Helper to execute Gemini calls with automatic single 503 load-spike retry
const callModelWithRetry = async (modelInstance: any, payload: any): Promise<any> => {
  try {
    return await modelInstance.generateContent(payload);
  } catch (err: any) {
    const errStr = err?.message || String(err);
    // Requirement 2: Do NOT retry on 429 / quota errors
    if (err?.status === 429 || errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
      throw err;
    }
    // Requirement 3: Exactly ONE retry after 1-second delay for 503 only
    if (err?.status === 503 || errStr.includes('503') || errStr.includes('Service Unavailable')) {
      console.warn('[MEMOFLOW CHAT] Gemini 503 transient load spike. Retrying once after 1000ms delay...');
      await new Promise(r => setTimeout(r, 1000));
      return await modelInstance.generateContent(payload);
    }
    throw err;
  }
};

// Helper to get Gemini client strictly on server side (cached singleton)
let cachedGenAI: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  if (!cachedGenAI) {
    cachedGenAI = new GoogleGenerativeAI(apiKey);
  }
  return cachedGenAI;
}

// SSRF Protection: Rejects private networks, loopbacks, and cloud metadata targets
function isSafePublicUrl(urlString: string): { valid: boolean; reason?: string } {
  try {
    const trimmed = (urlString || '').trim();
    if (!trimmed) {
      return { valid: false, reason: 'URL cannot be empty.' };
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Only http:// and https:// URLs are supported.' };
    }

    const hostname = parsed.hostname.toLowerCase().trim();

    // Loopback / localhost checks
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0'
    ) {
      return { valid: false, reason: 'Access to local resources is restricted.' };
    }

    // Cloud metadata & link-local
    if (hostname === '169.254.169.254' || hostname.startsWith('169.254.')) {
      return { valid: false, reason: 'Access to cloud metadata and link-local addresses is restricted.' };
    }

    // Private IPv4 ranges
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { valid: false, reason: 'Access to private network addresses is restricted.' };
    }
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { valid: false, reason: 'Access to private network addresses is restricted.' };
    }
    // 172.16.0.0/12 -> 172.16.x.x - 172.31.x.x
    const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return { valid: false, reason: 'Access to private network addresses is restricted.' };
      }
    }

    // IPv6 private / link-local
    if (hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) {
      return { valid: false, reason: 'Access to private network addresses is restricted.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Please enter a valid, well-formed URL.' };
  }
}

export const aiService = {
  /**
   * Text Validation Filter: Ensures text is non-empty, contains valid words,
   * and is not corrupted OCR gibberish before saving to DB.
   */
  validateExtractedText(text: string): { valid: boolean; reason?: string } {
    if (!text || !text.trim()) {
      return { valid: false, reason: 'Extracted text is empty.' };
    }
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      return { valid: false, reason: 'Extracted text is too short to be valid.' };
    }

    // Check for excessive single-character repetition (e.g. "aaaaa..." or "::::::...")
    if (/(.)\1{14,}/.test(trimmed)) {
      return { valid: false, reason: 'Extracted text contains suspicious repeated character sequences.' };
    }

    // Check symbol ratio
    const symbolCount = (trimmed.match(/[@\\|~^{}\[\]<>#$%\*]/g) || []).length;
    if (trimmed.length > 40 && (symbolCount / trimmed.length) > 0.35) {
      return { valid: false, reason: 'Extracted text contains excessive symbol noise.' };
    }

    return { valid: true };
  },

  /**
   * Centralized OCR Engine using Gemini Vision:
   * Strictly uses Gemini Vision API without silent fallback to garbled Tesseract.
   */
  async performOCR(cleanBase64: string, mimeType: string = 'image/png'): Promise<OCROutput> {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasKey = !!(apiKey && apiKey.trim() !== '');

    console.log('[MEMOFLOW OCR] Starting OCR Process');
    console.log('[MEMOFLOW OCR] File mimeType:', mimeType);
    console.log('[MEMOFLOW OCR] Payload Base64 char count:', cleanBase64.length);
    console.log('[MEMOFLOW OCR] Selected Gemini Primary Model:', PRIMARY_MODEL);
    console.log('[MEMOFLOW OCR] GEMINI_API_KEY Exists:', hasKey);

    if (!hasKey) {
      console.error('[MEMOFLOW OCR] GEMINI_API_KEY is not defined in process.env.');
      return {
        text: '',
        engine: 'gemini',
        success: false,
        error: 'GEMINI_API_KEY is missing in server environment (.env.local).'
      };
    }

    try {
      console.log('[MEMOFLOW OCR] Gemini request started...');
      const startTime = Date.now();
      const genAI = new GoogleGenerativeAI(apiKey!);
      
      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/png',
        },
      };

      const systemPrompt = `You are a professional document and handwriting OCR engine.

Extract ONLY the meaningful text visible in the supplied image.

Rules:
- Extract text from printed documents, screenshots, whiteboards, and handwritten notes.
- Preserve actual words, headings, bullet points, numbers, and structural paragraphs.
- If handwriting or text is messy or low confidence, extract the best readable text and mark unclear parts as [unclear].
- Do not invent missing text or hallucinate words.
- Ignore decorative graphics, icons, and pure visual noise.
- Do not output explanations, intros, or commentary.
- Return clean plain text / Markdown.`;

      let rawText = '';
      try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await callModelWithRetry(model, [systemPrompt, imagePart]);
        rawText = (await result.response).text();
      } catch (primaryErr: any) {
        const pErrStr = primaryErr?.message || String(primaryErr);
        console.warn(`[MEMOFLOW OCR] ${PRIMARY_MODEL} API call error:`, pErrStr);

        if (primaryErr?.status === 429 || pErrStr.includes('429') || pErrStr.toLowerCase().includes('quota') || pErrStr.includes('RESOURCE_EXHAUSTED')) {
          console.error('[MEMOFLOW OCR] Gemini 429 Quota Exceeded.');
          return {
            text: '',
            engine: 'gemini',
            success: false,
            error: 'AI is temporarily rate-limited. Please try again in a moment.'
          };
        }

        if (PRIMARY_MODEL !== FALLBACK_MODEL) {
          console.log(`[MEMOFLOW OCR] Trying secondary fallback model (${FALLBACK_MODEL})...`);
          const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
          const result = await callModelWithRetry(fallbackModel, [systemPrompt, imagePart]);
          rawText = (await result.response).text();
        } else {
          throw primaryErr;
        }
      }

      const durationMs = Date.now() - startTime;
      console.log(`[MEMOFLOW OCR] Gemini response received in ${durationMs}ms`);

      let cleanText = rawText.trim();
      if (cleanText.startsWith('```') && cleanText.endsWith('```')) {
        cleanText = cleanText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
      }

      console.log(`[MEMOFLOW OCR] Extracted text character count: ${cleanText.length}`);

      // Validate extracted text
      const validation = this.validateExtractedText(cleanText);
      if (!validation.valid) {
        console.warn('[MEMOFLOW OCR] Validation failed:', validation.reason);
        return {
          text: '',
          engine: 'gemini',
          success: false,
          error: `OCR Extraction Failed Validation: ${validation.reason}`
        };
      }

      return {
        text: cleanText,
        engine: 'gemini',
        success: true
      };

    } catch (geminiErr: any) {
      const errStr = geminiErr?.message || String(geminiErr);
      console.error('[MEMOFLOW OCR] Exact Gemini Error:', errStr);
      
      if (geminiErr?.status === 429 || errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        return {
          text: '',
          engine: 'gemini',
          success: false,
          error: 'AI is temporarily rate-limited. Please try again later.'
        };
      }

      if (geminiErr?.status === 503 || errStr.includes('503') || errStr.includes('Service Unavailable')) {
        return {
          text: '',
          engine: 'gemini',
          success: false,
          error: 'AI is temporarily busy with high demand. Please try again in a moment.'
        };
      }

      return {
        text: '',
        engine: 'gemini',
        success: false,
        error: `AI OCR Error: Failed to process image.`
      };
    }
  },

  /**
   * Centralized Speech-to-Text Transcription Engine using Gemini:
   * Accurately transcribes spoken audio recordings (WebM, WAV, MP3, etc.) into text.
   */
  async transcribeAudio(cleanBase64: string, mimeType: string = 'audio/webm'): Promise<{ text: string; success: boolean; error?: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasKey = !!(apiKey && apiKey.trim() !== '');

    console.log('[MEMOFLOW VOICE] Starting Speech-to-Text Process');
    console.log('[MEMOFLOW VOICE] Audio mimeType:', mimeType);
    console.log('[MEMOFLOW VOICE] Payload Base64 char count:', cleanBase64.length);

    if (!hasKey) {
      return {
        text: '',
        success: false,
        error: 'GEMINI_API_KEY is missing in server environment (.env.local).'
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey!);
      const audioPart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'audio/webm',
        },
      };

      const systemPrompt = `You are a professional speech-to-text audio transcription engine.
Transcribe the spoken audio with exact fidelity.
Rules:
- Output ONLY the clean transcribed spoken words.
- Do not add any timestamps, introductory notes, or commentary.
- If the audio is completely silent or contains no discernible speech, output: [No spoken speech detected]`;

      const startTime = Date.now();
      let rawText = '';

      try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await callModelWithRetry(model, [systemPrompt, audioPart]);
        rawText = (await result.response).text();
      } catch (primaryErr) {
        if (PRIMARY_MODEL !== FALLBACK_MODEL) {
          const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
          const result = await callModelWithRetry(fallbackModel, [systemPrompt, audioPart]);
          rawText = (await result.response).text();
        } else {
          throw primaryErr;
        }
      }

      const durationMs = Date.now() - startTime;
      console.log(`[MEMOFLOW VOICE] Gemini audio transcription received in ${durationMs}ms`);

      let cleanText = rawText.trim();
      if (cleanText.startsWith('```') && cleanText.endsWith('```')) {
        cleanText = cleanText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
      }

      return {
        text: cleanText,
        success: true
      };
    } catch (err: any) {
      const errStr = err?.message || String(err);
      console.error('[MEMOFLOW VOICE] Transcription error:', errStr);
      if (err?.status === 429 || errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        return {
          text: '',
          success: false,
          error: 'AI is temporarily rate-limited. Please try again in a moment.'
        };
      }
      return {
        text: '',
        success: false,
        error: errStr || 'Failed to transcribe audio'
      };
    }
  },

  /**
   * PDF Document Parsing Pipeline:
   * 1. Validates magic PDF header bytes (%PDF-).
   * 2. Extracts text from text-based PDFs deterministically using pdf-parse.
   * 3. For scanned/image PDFs (insufficient text), passes PDF buffer to Gemini Vision.
   */
  async parsePdfText(pdfBase64: string): Promise<string> {
    console.log('[MEMOFLOW PDF] Parsing PDF document...');
    try {
      const buffer = Buffer.from(pdfBase64, 'base64');
      const uint8Array = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
      );

      // Check header magic bytes
      const headerStr = buffer.slice(0, 5).toString('utf-8');
      if (headerStr !== '%PDF-') {
        // Check if buffer is PK zip archive (DOCX container)
        if (buffer.slice(0, 2).toString('utf-8') === 'PK') {
          console.log('[MEMOFLOW PDF] Provided buffer is a PK ZIP archive (DOCX file). Auto-routing to DOCX parser...');
          return this.parseDocxText(pdfBase64);
        }
        throw new Error('Invalid PDF file format (missing %PDF- header signature).');
      }

      // Use stable pdf-parse v1.1.1 with byte-aligned Uint8Array
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const data = await pdfParse(uint8Array);
      let text = (data.text || '').trim();

      // Clean control characters and normalize newlines
      text = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      if (text && text.length >= 30) {
        console.log(`[MEMOFLOW PDF] pdf-parse extracted ${text.length} chars from text PDF (${data.numpages} pages).`);
        return text;
      }

      // Scanned PDF detection: <30 chars embedded text
      console.log('[MEMOFLOW PDF] Text PDF extraction returned <30 chars. PDF appears to be a scanned document.');
      const genAI = getGeminiClient();
      if (genAI) {
        console.log('[MEMOFLOW PDF] GEMINI_API_KEY present. Running Gemini PDF Vision text extraction...');
        const pdfPart = {
          inlineData: {
            data: pdfBase64,
            mimeType: 'application/pdf'
          }
        };
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await model.generateContent([
          "You are a document extraction engine. Cleanly extract all readable text from this scanned PDF document, preserving headings, paragraphs, and lists.",
          pdfPart
        ]);
        const visionText = (await result.response).text().trim();
        if (visionText && visionText.length > 10) {
          console.log(`[MEMOFLOW PDF] Gemini PDF Vision extracted ${visionText.length} chars.`);
          return visionText;
        }
      } else {
        console.warn('[MEMOFLOW PDF] GEMINI_API_KEY is not defined. Cannot run AI OCR on scanned PDF.');
        return 'This PDF appears to be a scanned document without embedded text. Add GEMINI_API_KEY to .env.local to enable AI text extraction for scanned PDFs.';
      }

      return text || '[PDF document contains no readable text]';
    } catch (err: any) {
      console.error('[MEMOFLOW PDF] PDF parsing error:', err?.message || err);
      throw new Error(`PDF Extraction Failed: ${err?.message || String(err)}`);
    }
  },

  /**
   * DOCX Word Document Ingestion Pipeline:
   * Uses mammoth to extract clean text from .docx files deterministically without AI.
   */
    async parseDocxText(docxBase64: string): Promise<string> {
    console.log('[MEMOFLOW DOCX] Parsing DOCX document with mammoth...');
    try {
      const mammoth = require('mammoth');
      const buffer = Buffer.from(docxBase64, 'base64');
      const result = await mammoth.extractRawText({ buffer });
      let text = (result.value || '').trim();

      // Fallback to HTML conversion if raw extraction yields little content
      if (!text || text.length < 30) {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        const html = (htmlResult.value || '').trim();
        // Strip HTML tags and collapse whitespace
        text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Normalize paragraph breaks and remove null characters
      text = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      // Detect embedded images
      const hasEmbeddedImages = buffer.includes(Buffer.from('word/media/')) || buffer.includes(Buffer.from('media/image'));

      console.log(`[MEMOFLOW DOCX] Extracted ${text.length} chars from DOCX file. Embedded images detected: ${hasEmbeddedImages}`);

      let finalText = text;
      if (hasEmbeddedImages) {
        finalText = `${finalText ? finalText + '\n\n' : ''}[DOCX_HAS_EMBEDDED_IMAGES]`;
      }

      if (!finalText) {
        return '[DOCX Document contains no readable text]';
      }
      return finalText;
    } catch (err: any) {
      console.error('[MEMOFLOW DOCX] Error extracting DOCX text:', err?.message || err);
      throw new Error(`DOCX Extraction Failed: ${err?.message || String(err)}`);
    }
  },

  /**
   * Plain TXT Document Ingestion Pipeline:
   * Deterministic text extraction from text/plain files without AI.
   */
  async parseTxtText(txtBase64: string): Promise<string> {
    console.log('[MEMOFLOW TXT] Parsing plain text file...');
    try {
      const buffer = Buffer.from(txtBase64, 'base64');
      let text = buffer.toString('utf-8').trim();
      text = text.replace(/\0/g, '').replace(/\r\n/g, '\n').trim();
      console.log(`[MEMOFLOW TXT] Extracted ${text.length} chars from TXT file.`);
      return text || '[Text file is empty]';
    } catch (err: any) {
      console.error('[MEMOFLOW TXT] Error parsing text file:', err?.message || err);
      throw new Error(`TXT Extraction Failed: ${err?.message || String(err)}`);
    }
  },

  /**
   * Link Content Fetching Pipeline with SSRF Protection & Gemini Synthesis
   */
  async fetchLinkContent(url: string): Promise<LinkContentResult> {
    const safeCheck = isSafePublicUrl(url);
    if (!safeCheck.valid) {
      return {
        title: 'Webpage',
        content: '',
        success: false,
        error: safeCheck.reason || 'Invalid or restricted URL.'
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 MemoFlow/1.0',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 404) {
          return { title: 'Webpage', content: '', success: false, error: 'Webpage not found (HTTP 404).' };
        }
        if (res.status === 401 || res.status === 403) {
          return { title: 'Webpage', content: '', success: false, error: 'Access to this webpage is restricted or requires authentication.' };
        }
        return { title: 'Webpage', content: '', success: false, error: `Webpage returned an error (HTTP ${res.status}).` };
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        contentType.includes('application/pdf')
      ) {
        return {
          title: 'Media File',
          content: '',
          success: false,
          error: 'This URL points to a media/binary file. Please upload files directly using the respective tab.'
        };
      }

      // Enforce 2 MB body size limit
      const MAX_BYTES = 2 * 1024 * 1024;
      let html = '';
      if (res.body) {
        const reader = res.body.getReader();
        let bytesReceived = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            bytesReceived += value.length;
            if (bytesReceived > MAX_BYTES) {
              chunks.push(value.subarray(0, value.length - (bytesReceived - MAX_BYTES)));
              reader.cancel();
              break;
            }
            chunks.push(value);
          }
        }
        const fullBuffer = new Uint8Array(Math.min(bytesReceived, MAX_BYTES));
        let pos = 0;
        for (const ch of chunks) {
          fullBuffer.set(ch, pos);
          pos += ch.length;
        }
        html = new TextDecoder('utf-8', { fatal: false }).decode(fullBuffer);
      } else {
        html = await res.text();
      }

      // Extract title from og:title or <title>
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let rawTitle = (ogTitleMatch ? ogTitleMatch[1] : titleMatch ? titleMatch[1] : '').trim();
      rawTitle = rawTitle
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
      const finalTitle = rawTitle || 'Web Article';

      // Clean HTML and extract readable content
      let bodyText = html;
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) bodyText = bodyMatch[1];

      bodyText = bodyText
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
        .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
        .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n\n')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!bodyText || bodyText.length < 50) {
        return {
          title: finalTitle,
          content: '',
          success: false,
          error: 'Could not extract readable article text. You can paste the text manually.'
        };
      }

      const genAI = getGeminiClient();
      if (genAI) {
        try {
          const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
          const prompt = `You are MemoFlow AI, a document analysis and knowledge assistant.
Analyze the following webpage article text and synthesize it into a clean, comprehensive, structured memory note.

Webpage Title: "${finalTitle}"
Source URL: ${url}
Extracted Article Text:
"""
${bodyText.substring(0, 12000)}
"""

Return a JSON object in this exact format without any markdown code blocks:
{
  "title": "Clean, descriptive title for the note",
  "content": "Comprehensive markdown note organizing the article's core points, insights, sections, and important details. Use clean markdown formatting (headings, bullet points, key concepts).",
  "summary": "2 to 3 sentence concise executive summary of the article.",
  "takeaways": ["3 to 5 specific, high-value key takeaways or insights from the article"],
  "tags": ["3 to 5 relevant topic tags"]
}`;

          const result = await model.generateContent(prompt);
          let rawText = (await result.response).text().trim();
          if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
          }
          const parsed = JSON.parse(rawText);
          if (parsed && parsed.content) {
            return {
              title: parsed.title || finalTitle,
              content: parsed.content,
              summary: parsed.summary || `Summary of "${finalTitle}"`,
              takeaways: Array.isArray(parsed.takeaways) && parsed.takeaways.length > 0 ? parsed.takeaways : [`Source: ${url}`],
              tags: Array.isArray(parsed.tags) ? parsed.tags : ['WebArticle'],
              success: true
            };
          }
        } catch (geminiErr: any) {
          console.warn('[Link Fetch] Gemini analysis error, falling back to clean text:', geminiErr?.message || geminiErr);
        }
      }

      // Fallback if Gemini model is unavailable
      const fallbackSummary = bodyText.substring(0, 300).replace(/\s+/g, ' ').trim() + '...';
      return {
        title: finalTitle,
        content: bodyText.substring(0, 5000),
        summary: fallbackSummary,
        takeaways: [`Source: ${url}`, `Extracted web article content.`],
        tags: ['WebArticle', 'Link'],
        success: true
      };
    } catch (err: any) {
      const errStr = err?.message || String(err);
      console.warn('[Link Fetch] URL fetch error:', errStr);
      if (err?.name === 'AbortError' || errStr.includes('timeout') || errStr.includes('aborted')) {
        return {
          title: 'Webpage',
          content: '',
          success: false,
          error: 'The request timed out while connecting to the webpage (10-second limit).'
        };
      }
      return {
        title: 'Webpage',
        content: '',
        success: false,
        error: 'Could not extract readable article text. You can paste the text manually.'
      };
    }
  },

  /**
   * Centralized RAG AI Assistant Chat Engine:
   * Generates intelligent, document-grounded answers based on user query and workspace context.
   */
  async queryMemoryChat(
    query: string,
    notes: Note[] = [],
    imageBase64?: string,
    imageMime?: string,
    activeNote?: { title: string; content: string; type: string; imageBase64?: string; imageMime?: string }
  ): Promise<{ answer: string; citations: string[] }> {
    const genAI = getGeminiClient();

    // Filter out active note from background workspace notes to prevent duplication
    const backgroundNotes = notes.filter(n => {
      if (!activeNote) return true;
      if (activeNote.title && n.title && n.title.toLowerCase().trim() === activeNote.title.toLowerCase().trim()) {
        return false;
      }
      return true;
    });

    // Format background workspace notes compactly (Metadata + Summary / Short Excerpt)
    const contextStr = backgroundNotes.length > 0
      ? backgroundNotes.slice(0, 8).map((n, i) => {
          const summaryOrExcerpt = n.summary && n.summary.trim() !== ''
            ? n.summary
            : (n.content ? n.content.substring(0, 200).replace(/\s+/g, ' ').trim() + '...' : '');
          return `[Background Note ${i + 1}]
Title: ${n.title || 'Untitled'}
Type: ${n.type || 'note'}
Category: ${n.category || 'Personal'}
Summary: ${summaryOrExcerpt}`;
        }).join('\n\n')
      : 'No other background notes found in workspace.';

    const activeDocContext = activeNote
      ? `\n\n--- ACTIVE DOCUMENT CONTEXT ---\nTitle: ${activeNote.title}\nDocument Type: ${activeNote.type}\nExtracted Content:\n${activeNote.content}\n--- END ACTIVE DOCUMENT ---`
      : '';

    const systemInstruction = `You are MemoFlow AI, an intelligent personal knowledge and general-purpose AI assistant.

Your role:
1. MEMORY-AWARE ASSISTANCE: If the user's question relates to their saved notes, documents, voice memos, or workspace content (provided in ACTIVE DOCUMENT or Workspace Notes Context below), use that context to give an accurate, grounded answer. Preserve exact facts and terminology from their notes.
2. GENERAL KNOWLEDGE ASSISTANCE: If the user's question is a general question, explanation, coding help, writing task, or inquiry NOT covered by their saved memories (e.g. "What is artificial intelligence?", "Explain photosynthesis", "Write an email"), answer comprehensively, helpfully, and directly using your general knowledge.
3. COMBINED QUESTIONS: If the question asks both about their saved memories and for a general explanation (e.g., "What did I save about AI, and explain how the concept works?"), address the saved memory content first, and then provide the general knowledge explanation.
4. HONEST CONTEXT HANDLING: NEVER invent memories or falsely claim information came from the user's saved notes if it did not. If the user explicitly asks "what did I save about X" and no notes mention X, plainly state that no saved notes match X, then offer to help with general knowledge. If the user asks a general question (like "What is photosynthesis?"), do NOT say "I couldn't find this in your notes" — just answer the question directly.
5. FORMATTING: Structure your answer using clean, readable Markdown (bold headings, short paragraphs, or bullet points).`;

    if (genAI) {
      try {
        const prompt = `${systemInstruction}

${activeDocContext}

Workspace Notes Context:
${contextStr}

User Question: ${query}`;

        const contentParts: any[] = [prompt];

        // Attach image for Gemini Vision analysis if image is present
        const imgBase64 = activeNote?.imageBase64 || imageBase64;
        const imgMime = activeNote?.imageMime || imageMime || 'image/png';
        if (imgBase64 && imgMime) {
          console.log('[MEMOFLOW CHAT] Attaching image to Gemini Vision chat query...');
          contentParts.push({
            inlineData: {
              data: imgBase64,
              mimeType: imgMime
            }
          });
        }

        let rawAnswer = '';
        try {
          const model = genAI.getGenerativeModel({
            model: PRIMARY_MODEL,
            generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
          });
          const result = await callModelWithRetry(model, contentParts);
          rawAnswer = (await result.response).text();
        } catch (primaryErr: any) {
          const pErrStr = primaryErr?.message || String(primaryErr);
          if (primaryErr?.status === 429 || pErrStr.includes('429') || pErrStr.toLowerCase().includes('quota') || pErrStr.includes('RESOURCE_EXHAUSTED')) {
            console.warn('[MEMOFLOW CHAT] Gemini API rate limit hit (429).');
            return {
              answer: "AI is temporarily rate-limited. Please try again in a moment.",
              citations: activeNote ? [activeNote.title] : []
            };
          }
          // Avoid duplicate calls when PRIMARY_MODEL and FALLBACK_MODEL are identical
          if (PRIMARY_MODEL === FALLBACK_MODEL) {
            throw primaryErr;
          }
          const fallbackModel = genAI.getGenerativeModel({
            model: FALLBACK_MODEL,
            generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
          });
          const result = await callModelWithRetry(fallbackModel, contentParts);
          rawAnswer = (await result.response).text();
        }

        const cleanAnswer = rawAnswer.trim();

        // Citation detection: only cite a note if:
        // 1. Its title has non-trivial length (>= 3 chars)
        // 2. The title is explicitly referenced in the AI answer, OR (the query explicitly mentions it AND notes exist)
        // Do NOT cite if the answer indicates no notes were found.
        const lowerAnswer = cleanAnswer.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const citesNoNotes = lowerAnswer.includes('no saved notes') || lowerAnswer.includes('no notes found') || lowerAnswer.includes("don't have any notes");

        let citations: string[] = [];
        if (!citesNoNotes) {
          citations = notes
            .filter(n => {
              if (!n?.title || n.title.trim().length < 3) return false;
              const titleLower = n.title.toLowerCase().trim();
              return lowerAnswer.includes(titleLower) || lowerQuery.includes(titleLower);
            })
            .map(n => n.title);
        }

        return {
          answer: cleanAnswer,
          citations: citations.length > 0 ? citations : (activeNote && !citesNoNotes ? [activeNote.title] : [])
        };
      } catch (err: any) {
        const errStr = err?.message || String(err);
        console.warn('[MEMOFLOW CHAT] Gemini chat error:', errStr);
        if (errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
          return {
            answer: "AI is temporarily rate-limited. Please try again in a moment.",
            citations: activeNote ? [activeNote.title] : []
          };
        }
      }
    }

    // Clean user-facing message when Gemini AI service is unavailable
    return {
      answer: "AI is temporarily unavailable. Please try again in a moment.",
      citations: activeNote ? [activeNote.title] : []
    };
  },

  /**
   * Centralized AI Memory Summarization & Analysis Engine:
   * Generates strictly content-grounded summaries, key takeaways, action items, and entity details.
   */
  async generateMemoryAnalysis(title: string, content: string, category: string = 'Personal'): Promise<AISummaryResult> {
    const cleanContent = (content || '').replace('[DOCX_HAS_EMBEDDED_IMAGES]', '').trim();

    if (!cleanContent || cleanContent === '[Saved Image Node]' || cleanContent.startsWith('[OCR_FAILED]')) {
      return {
        summary: `Document text is not extracted yet. Click "Extract Text (OCR)" on the image/document first to run AI synthesis.`,
        takeaways: [
          `Original attachment saved safely.`,
          `Run OCR to extract document text for deep AI insights.`
        ],
        suggestedTags: [category, 'AttachmentSaved'],
        extractedTasks: []
      };
    }

    const genAI = getGeminiClient();

    if (genAI) {
      try {
        const prompt = `You are MemoFlow AI, a document analysis assistant.
Analyze this document strictly based on its provided text. Do not invent information.

Title: "${title || ''}"
Content:
"""
${cleanContent.substring(0, 16000)}
"""

Return a JSON object strictly in this format without markdown code blocks:
{
  "summary": "Concise 2 to 4 sentence executive summary based strictly on the document text.",
  "takeaways": ["3 to 5 specific, meaningful takeaways or facts extracted from the document"],
  "suggestedTags": ["3 to 5 relevant topic tags"],
  "extractedTasks": ["Real actionable tasks detected in document, or empty array [] if none exist"]
}`;

        let rawText = '';
        try {
          const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
          const result = await model.generateContent(prompt);
          rawText = (await result.response).text();
        } catch (primaryErr) {
          const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
          const result = await fallbackModel.generateContent(prompt);
          rawText = (await result.response).text();
        }

        let jsonStr = rawText.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
        }

        const parsed = JSON.parse(jsonStr);
        if (parsed.summary && Array.isArray(parsed.takeaways) && parsed.takeaways.length > 0) {
          return {
            summary: parsed.summary,
            takeaways: parsed.takeaways,
            suggestedTags: Array.isArray(parsed.suggestedTags) && parsed.suggestedTags.length > 0
              ? parsed.suggestedTags
              : [category, 'DocumentNote'],
            extractedTasks: Array.isArray(parsed.extractedTasks) ? parsed.extractedTasks : []
          };
        }
      } catch (err: any) {
        console.warn('[aiService] Gemini Memory Analysis warning:', err?.message || err);
      }
    }

    // Local deterministic fallback based strictly on actual extracted text content
    const paragraphs = cleanContent.split(/\n+/).map(p => p.trim()).filter(p => p.length > 15);
    const summaryText = paragraphs.length >= 2
      ? paragraphs.slice(0, 3).join(' ')
      : paragraphs.length === 1
      ? paragraphs[0]
      : `Document content saved under ${category} context.`;

    const takeawaysList = paragraphs.length > 0
      ? paragraphs.slice(0, 4).map(p => p.length > 120 ? p.substring(0, 117) + '...' : p)
      : [`Document content saved in ${category} context.`];

    return {
      summary: summaryText.substring(0, 450),
      takeaways: takeawaysList,
      suggestedTags: [category, 'MemoryNote'],
      extractedTasks: []
    };
  },

  /**
   * On-Demand Interactive Quiz Generator Engine
   */
  async generateQuiz(
    title: string, 
    content: string, 
    numQuestions: number = 5, 
    difficulty: string = 'medium'
  ): Promise<Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation?: string }>> {
    const cleanContent = (content || '').replace('[DOCX_HAS_EMBEDDED_IMAGES]', '').trim();
    const sourceText = cleanContent && cleanContent !== '[Saved Image Node]' ? cleanContent : title;

    if (!sourceText || sourceText.length < 5) {
      return [];
    }

    const genAI = getGeminiClient();

    if (genAI) {
      try {
        const prompt = `You are MemoFlow AI, an educational review engine.
Based strictly on the following note content, generate ${numQuestions} distinct multiple-choice quiz questions at ${difficulty} difficulty level for active recall review.

Rules:
- Questions must test concepts, facts, procedures, relationships, or key details that actually appear in the document text.
- Create 4 plausible options per question, with exactly 1 correct answer (index 0 to 3).
- Include a 1-sentence explanation for why the correct answer is right.
- Avoid trivial title-only questions.
- Avoid generic distractors or unrelated options.

Title: "${title || ''}"
Content:
"""
${sourceText.substring(0, 12000)}
"""

Return a JSON array strictly in this format without markdown code blocks:
[
  {
    "id": "q1",
    "question": "Specific question testing a concept/fact from the text?",
    "options": ["Correct Answer Option", "Plausible Option B", "Plausible Option C", "Plausible Option D"],
    "correctAnswer": 0,
    "explanation": "Brief explanation of the correct answer."
  }
]`;

        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
        const result = await model.generateContent(prompt);
        let rawText = (await result.response).text().trim();
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
        }

        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, numQuestions).map((q, idx) => ({
            id: q.id || `q-${Date.now()}-${idx}`,
            question: q.question || `Question ${idx + 1} based on document`,
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
            explanation: q.explanation || `The correct answer is derived from "${title}".`
          }));
        }
      } catch (err) {
        console.warn('[aiService] generateQuiz warning:', err);
      }
    }

    // High quality content fallback if Gemini fails or returns empty
    const lines = sourceText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 20);
    const questions: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation?: string }> = [];

    const targetCount = Math.min(numQuestions, Math.max(lines.length, 3));
    for (let i = 0; i < targetCount; i++) {
      const line = lines[i % lines.length] || `Core concept from ${title}`;
      const snippet = line.length > 80 ? line.substring(0, 77) + '...' : line;

      questions.push({
        id: `q-fallback-${Date.now()}-${i}`,
        question: `Based on "${title}", which statement correctly reflects: "${snippet}"?`,
        options: [
          snippet,
          `Alternative interpretation of concept ${i + 1}`,
          `Unrelated detail not mentioned in ${title}`,
          `Opposite statement regarding the document topic`
        ],
        correctAnswer: 0,
        explanation: `Factual statement directly matching the document content.`
      });
    }

    return questions;
  }
};
