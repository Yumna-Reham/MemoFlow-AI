'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, UploadCloud, Link as LinkIcon, FileText, Brain, Sparkles, Camera, Mic, 
  HardDrive, Paperclip, Trash2, File as FileIcon, Image as ImageIcon, Square, Volume2, Play, ScanSearch, Check
} from 'lucide-react';
import { Note, Collection, WORKSPACE_CATEGORIES, NoteAttachment } from '../mockData';
import { storageService } from '@/lib/services/storageService';
import { autoInferCollection } from '@/lib/services/collectionsService';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  preselectedType?: string;
  onSaveNote: (note: Note) => void;
}

// Helper function to detect file category
const detectFileType = (file: File): 'image' | 'pdf' | 'docx' | 'txt' | 'other' => {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
    name.endsWith('.docx')
  ) return 'docx';
  if (mime === 'text/plain' || name.endsWith('.txt')) return 'txt';
  
  return 'other';
};

const generateSafeUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function QuickCaptureModal({ 
  isOpen, 
  onClose, 
  collections, 
  preselectedType = 'note',
  onSaveNote 
}: QuickCaptureModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState(preselectedType);
  const [content, setContent] = useState('');
  const [collection, setCollection] = useState('general');
  const [category, setCategory] = useState<string>('Personal');
  const [url, setUrl] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('Uploading memory...');

  // Web URL Ingestion States
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [ingestedMetadata, setIngestedMetadata] = useState<{ summary?: string; takeaways?: string[]; tags?: string[] } | null>(null);

  // Live Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [audioTranscriptNotice, setAudioTranscriptNotice] = useState<string | null>(null);
  
  // Image OCR Scanning State
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'success' | 'failed' | 'no_text'>('idle');
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setType(preselectedType);
      setTitle('');
      setContent('');
      setUrl('');
      setCategory('Personal');
      setAttachedFiles([]);
      setLoading(false);
      setProgress(0);
      setIsRecording(false);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setIsTranscribingAudio(false);
      setAudioTranscriptNotice(null);
      setIsScanningOcr(false);
      setOcrStatus('idle');
      setOcrNotice(null);
      setMicPermissionError(false);
      setIsFetchingLink(false);
      setLinkError(null);
      setLinkSuccess(false);
      setIngestedMetadata(null);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, preselectedType]);

  if (!isOpen) return null;

  // Audio Recording Methods
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      setMicPermissionError(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Real Audio Transcription Ingestion (User Triggered)
  const handleTranscribeAudio = async (blob: Blob) => {
    setIsTranscribingAudio(true);
    setAudioTranscriptNotice('Transcribing audio...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(',')[1];
          const mimeType = blob.type || 'audio/webm';
          const res = await fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'audio', fileBase64: base64Str, url: mimeType })
          });
          const data = await res.json();
          if (data.success && data.text) {
            setContent(data.text);
            setAudioTranscriptNotice('Voice memo transcribed successfully!');
            if (!title.trim()) {
              const cleanPreview = data.text.replace(/^[#*\s-]+/, '').trim();
              const derived = cleanPreview.length > 50 ? cleanPreview.substring(0, 47) + '...' : cleanPreview;
              setTitle(derived ? `Voice: ${derived}` : `Voice Memo ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            }
          } else {
            console.warn('[MEMOFLOW AUDIO] Transcription notice:', data.error);
            setAudioTranscriptNotice(data.error || 'Could not transcribe audio.');
          }
        } catch (err: any) {
          console.error('[MEMOFLOW AUDIO] Response parse error:', err);
          setAudioTranscriptNotice('Could not parse transcription response.');
        } finally {
          setIsTranscribingAudio(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error('[MEMOFLOW AUDIO] Ingestion error:', err);
      setAudioTranscriptNotice('Failed to transcribe audio.');
      setIsTranscribingAudio(false);
    }
  };

  // Helper to prevent duplicate attachments in state
  const addAttachmentsWithoutDuplicates = (newFiles: File[]) => {
    setAttachedFiles(prev => {
      const filtered = newFiles.filter(nf =>
        !prev.some(ef => ef.name === nf.name && ef.size === nf.size && ef.lastModified === nf.lastModified)
      );
      return [...prev, ...filtered];
    });
  };

  // Helper to detect actual file type from File object metadata & extension
  const detectFileType = (file: File): 'pdf' | 'docx' | 'txt' | 'image' | 'unknown' => {
    const name = file.name.toLowerCase();
    const mime = file.type.toLowerCase();

    if (name.endsWith('.pdf') || mime === 'application/pdf') {
      return 'pdf';
    }
    if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('wordprocessingml') || mime.includes('msword')) {
      return 'docx';
    }
    if (name.endsWith('.txt') || mime === 'text/plain') {
      return 'txt';
    }
    if (mime.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
      return 'image';
    }
    return 'unknown';
  };

  // Compress image client-side before sending to server to prevent payload bottlenecks
  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Optimal resolution for Gemini Vision OCR processing speed
          const MAX_SIZE = 1200;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, mimeType: 'image/jpeg' });
        };
        img.onerror = () => {
          const rawBase64 = (e.target?.result as string)?.split(',')[1] || '';
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: file.type || 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  // Real Gemini Vision API Image OCR Extractor with 90-Second Timeout
  const handleScanOcr = async (imageFile: File) => {
    setIsScanningOcr(true);
    setOcrStatus('processing');
    setOcrNotice(null);
    setContent('Reading image with AI OCR...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 90000);

    try {
      const { base64: compressedBase64, mimeType: compressedMime } = await compressImage(imageFile);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compressedBase64,
          mimeType: compressedMime
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (res.ok && data.text && data.success) {
        const extracted = data.text.trim();
        if (!extracted || extracted === '[unreadable]' || extracted === '[unclear]') {
          setOcrStatus('no_text');
          setOcrNotice('No readable text found in image. Original image attachment will still be saved.');
          setContent('');
        } else {
          setOcrStatus('success');
          setContent(extracted);
          if (extracted.includes('[unclear]') || extracted.includes('[unreadable]')) {
            setOcrNotice('Handwritten / Low-confidence text detected. Review and edit before saving as a memory.');
          }
          if (!title.trim()) {
            const cleanName = imageFile.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
            setTitle(`Scanned: ${cleanName || 'Document'}`);
          }
        }
      } else {
        const errorMsg = data.error || 'Failed to extract text from image.';
        console.error('[MEMOFLOW OCR] Gemini OCR Failed:', errorMsg);
        setOcrStatus('failed');
        setOcrNotice(errorMsg);
        setContent('');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('[MEMOFLOW OCR] Request timed out after 90 seconds.');
        setOcrStatus('failed');
        setOcrNotice('OCR request timed out. Please try again.');
        setContent('');
      } else {
        console.error('[MEMOFLOW OCR] Fetch Error:', err);
        setOcrStatus('failed');
        setOcrNotice(err?.message || 'Failed to extract text from image.');
        setContent('');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsScanningOcr(false);
    }
  };

  // Real PDF Document Text Extraction Ingestion
  const handleScanPdf = async (pdfFile: File) => {
    setIsScanningOcr(true);
    setContent('Reading PDF document...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = (reader.result as string).split(',')[1];
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pdf', fileBase64: base64Str })
        });
        const data = await res.json();
        if (data.success && data.text) {
          setContent(data.text);
          if (!title.trim()) {
            const lines = data.text.split(/\n+/).map((l: string) => l.replace(/^[#*\s-]+/, '').trim()).filter((l: string) => l.length >= 3 && !l.startsWith('['));
            const firstMeaningfulLine = lines.find((l: string) => !/^(qualities|criteria|points|page|table)/i.test(l));
            const cleanName = pdfFile.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
            const fallbackTitle = cleanName && cleanName.length > 2 && cleanName !== '1' ? cleanName : 'Document';
            setTitle(firstMeaningfulLine ? firstMeaningfulLine.substring(0, 60) : `PDF: ${fallbackTitle}`);
          }
        } else {
          setContent(`[PDF_FAILED]\n\n${data.error || 'Failed to parse PDF document.'}`);
        }
      };
      reader.readAsDataURL(pdfFile);
    } catch (err: any) {
      console.error('[MEMOFLOW PDF] Ingestion error:', err);
      setContent(`[PDF_FAILED]\n\nFailed to extract text from PDF document.`);
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Real DOCX Word Document Extraction Ingestion
  const handleScanDocx = async (docxFile: File) => {
    setIsScanningOcr(true);
    setContent('Reading Word document...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = (reader.result as string).split(',')[1];
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'docx', fileBase64: base64Str })
        });
        const data = await res.json();
        if (data.success && data.text) {
          setContent(data.text);
          if (!title.trim()) {
            const lines = data.text.split(/\n+/).map((l: string) => l.replace(/^[#*\s-]+/, '').trim()).filter((l: string) => l.length >= 3 && !l.startsWith('['));
            const firstMeaningfulLine = lines.find((l: string) => !/^(qualities|criteria|points|page|table)/i.test(l));
            const cleanName = docxFile.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
            const fallbackTitle = cleanName && cleanName.length > 2 && cleanName !== '1' ? cleanName : 'Document';
            setTitle(firstMeaningfulLine ? firstMeaningfulLine.substring(0, 60) : `Doc: ${fallbackTitle}`);
          }
        } else {
          setContent(`[DOCX_FAILED]\n\n${data.error || 'Failed to parse DOCX document.'}`);
        }
      };
      reader.readAsDataURL(docxFile);
    } catch (err: any) {
      console.error('[MEMOFLOW DOCX] Ingestion error:', err);
      setContent(`[DOCX_FAILED]\n\nFailed to extract text from Word document.`);
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Real TXT Document Extraction Ingestion
  const handleScanTxt = async (txtFile: File) => {
    setIsScanningOcr(true);
    setContent('Reading text file...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = (reader.result as string).split(',')[1];
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'txt', fileBase64: base64Str })
        });
        const data = await res.json();
        if (data.success && data.text) {
          setContent(data.text);
          if (!title.trim()) {
            const lines = data.text.split(/\n+/).map((l: string) => l.replace(/^[#*\s-]+/, '').trim()).filter((l: string) => l.length >= 3 && !l.startsWith('['));
            const firstMeaningfulLine = lines.find((l: string) => !/^(qualities|criteria|points|page|table)/i.test(l));
            const cleanName = txtFile.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
            const fallbackTitle = cleanName && cleanName.length > 2 && cleanName !== '1' ? cleanName : 'Document';
            setTitle(firstMeaningfulLine ? firstMeaningfulLine.substring(0, 60) : `Text: ${fallbackTitle}`);
          }
        } else {
          setContent(`[TXT_FAILED]\n\n${data.error || 'Failed to read text file.'}`);
        }
      };
      reader.readAsDataURL(txtFile);
    } catch (err: any) {
      console.error('[MEMOFLOW TXT] Ingestion error:', err);
      setContent(`[TXT_FAILED]\n\nFailed to read text file.`);
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Real URL Link Content Ingestion
  const handleFetchLink = async () => {
    const targetUrl = url.trim();
    if (!targetUrl) {
      setLinkError('Please enter an article or webpage URL.');
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setLinkError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setIsFetchingLink(true);
    setLinkError(null);
    setLinkSuccess(false);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'link', url: targetUrl })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.title) {
          setTitle(data.title);
        }
        if (data.text) {
          setContent(data.text);
        }
        setIngestedMetadata({
          summary: data.summary,
          takeaways: data.takeaways,
          tags: data.tags
        });
        setLinkSuccess(true);
      } else {
        setLinkError(data.error || 'Could not extract readable article text. You can paste the text manually.');
      }
    } catch (err: any) {
      console.warn('[QuickCaptureModal] Link ingestion error:', err);
      setLinkError('Could not extract readable article text. You can paste the text manually.');
    } finally {
      setIsFetchingLink(false);
    }
  };

  const handleTypeChange = (newType: string) => {
    if (newType !== type) {
      setType(newType);
      setAttachedFiles([]);
      setContent('');
      setTitle('');
      setIsScanningOcr(false);
      setAudioBlob(null);
      setAudioUrl(null);
      setIsFetchingLink(false);
      setLinkError(null);
      setLinkSuccess(false);
      setIngestedMetadata(null);
      setUrl('');
    }
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);

      addAttachmentsWithoutDuplicates(selected);

      const primaryFile = selected[0];
      const actualType = detectFileType(primaryFile);

      console.log(`[MEMOFLOW INGEST] Attached file: ${primaryFile.name} (${primaryFile.type}, ${primaryFile.size} bytes). Detected type: ${actualType}`);

      if (actualType === 'docx') {
        handleScanDocx(primaryFile);
      } else if (actualType === 'pdf') {
        handleScanPdf(primaryFile);
      } else if (actualType === 'txt') {
        handleScanTxt(primaryFile);
      } else if (actualType === 'image') {
        if (!title.trim()) {
          const cleanName = primaryFile.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
          setTitle(`Image: ${cleanName || 'Document'}`);
        }
      } else {
        if (type === 'pdf') {
          handleScanPdf(primaryFile);
        } else if (type === 'docx') {
          handleScanDocx(primaryFile);
        } else if (!title.trim()) {
          const cleanName = primaryFile.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
          setTitle(`Captured: ${cleanName || 'Memory'}`);
        }
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleManualAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedAudio = e.target.files[0];
      setAudioBlob(selectedAudio);
      setAudioUrl(URL.createObjectURL(selectedAudio));
      setAttachedFiles(prev => [...prev, selectedAudio]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setContent('');
        setTitle('');
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || (type === 'voice' ? `Voice Memo ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : type === 'screenshot' ? `Scanned Document Image` : 'Untitled Memory');
    const finalContent = content.trim() || (type === 'voice' ? `Voice Memo recorded on ${new Date().toLocaleString()}.` : 'Captured memory node.');

    if (finalContent.startsWith('[OCR_FAILED]') || finalContent.startsWith('[PDF_FAILED]') || finalContent.startsWith('[DOCX_FAILED]')) {
      alert('Document extraction failed. Please resolve the extraction issue or re-upload a valid readable document before saving.');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const stages = [
      { progress: 30, step: 'Uploading file attachments & saving memory...' },
      { progress: 65, step: 'Indexing memory metadata...' },
      { progress: 100, step: 'Saving note payload to workspace...' }
    ];

    let stageIdx = 0;
    const interval = setInterval(async () => {
      if (stageIdx < stages.length) {
        setProgress(stages[stageIdx].progress);
        setProcessingStep(stages[stageIdx].step);
        stageIdx++;
      } else {
        clearInterval(interval);
        
        const uploadedAttachments: NoteAttachment[] = [];

        if (audioBlob) {
          const voiceFile = new File(
            [audioBlob], 
            `Voice_Memo_${Date.now()}.webm`, 
            { type: audioBlob.type || 'audio/webm' }
          );
          const voiceResult = await storageService.uploadFile(voiceFile, 'voice_memos');
          const voiceAttId = generateSafeUuid();

          uploadedAttachments.push({
            id: voiceAttId,
            name: voiceFile.name,
            type: voiceFile.type,
            url: voiceResult.url,
            path: voiceResult.path,
            sizeBytes: voiceBlobSize(audioBlob),
          });
        }

        for (const file of attachedFiles) {
          if (file !== audioBlob) {
            const result = await storageService.uploadFile(file, 'attachments');
            const fileAttId = generateSafeUuid();

            uploadedAttachments.push({
              id: fileAttId,
              name: file.name,
              type: file.type || 'application/octet-stream',
              url: result.url,
              path: result.path,
              sizeBytes: file.size,
            });
          }
        }

        const generatedUuid = generateSafeUuid();

        const isImgNode = type === 'screenshot' || type === 'image' || attachedFiles.some(f => f.type.startsWith('image/'));

        const newNote: Note = {
          id: generatedUuid,
          title: finalTitle,
          type: type as any,
          content: finalContent || (isImgNode ? '[Saved Image Node]' : 'Captured memory node.'),
          summary: type === 'voice' 
            ? (content.trim() 
                ? `Voice memo transcript: ${content.trim().slice(0, 160)}${content.trim().length > 160 ? '...' : ''}` 
                : `Voice memo saved on ${new Date().toLocaleDateString()}.`)
            : type === 'link' && ingestedMetadata?.summary
            ? ingestedMetadata.summary
            : isImgNode
            ? `Image memory saved. Click "Extract Text (OCR)" in note detail view to run AI text extraction.`
            : `Saved ${type} memory node regarding "${finalTitle}".`,
          takeaways: type === 'voice' && content.trim()
            ? [
                `Spoken transcript: "${content.trim().slice(0, 100)}${content.trim().length > 100 ? '...' : ''}"`,
                `Categorized under ${category} context.`
              ]
            : type === 'link' && ingestedMetadata?.takeaways && ingestedMetadata.takeaways.length > 0
            ? ingestedMetadata.takeaways
            : [
                isImgNode ? 'Image attachment saved safely.' : 'Memory details stored.',
                `Categorized under ${category} context.`
              ],
          tasks: [
            { id: `t-${Date.now()}-1`, text: `Review memory details for ${finalTitle}`, completed: false }
          ],
          flashcards: [],
          quiz: [],
          collection: (collection && collection !== 'general' && collection !== 'unassigned') 
            ? collection 
            : autoInferCollection(finalTitle, finalContent, uploadedAttachments[0]?.name),
          category: category || 'Personal',
          tags: Array.from(new Set([
            type,
            ...(ingestedMetadata?.tags || []),
            ...(type === 'link' ? ['WebArticle'] : []),
            'SavedToday'
          ])),
          savedDate: new Date().toISOString().split('T')[0],
          savedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pinned: false,
          originalUrl: (type === 'youtube' || type === 'link') && url.trim() ? url.trim() : undefined,
          attachments: uploadedAttachments,
        };

        onSaveNote(newNote);
        setLoading(false);
        onClose();
      }
    }, 400);
  };

  const voiceBlobSize = (blob: Blob) => {
    return blob.size || 50000;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm font-sans">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-xs">
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-slate-800">Quick Capture Memory</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
                <Sparkles className="w-6 h-6 text-violet-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-900">{processingStep}</h4>
                <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto">
                  Parsing text strings, vectorizing metadata, and creating quiz index items...
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Type Switcher */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capture Format</label>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {[
                    { id: 'note', label: 'Note', icon: FileText },
                    { id: 'pdf', label: 'PDF', icon: HardDrive },
                    { id: 'screenshot', label: 'Scan / Image', icon: Camera },
                    { id: 'voice', label: 'Voice Memo', icon: Mic },
                    { id: 'link', label: 'URL Link', icon: LinkIcon },
                  ].map((t) => {
                    const IconComp = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTypeChange(t.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                          type === t.id
                            ? 'bg-violet-600 text-white border-transparent shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scan / Image OCR Section */}
              {type === 'screenshot' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-center">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Document & Image OCR Scanner
                    </span>
                    {isScanningOcr && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200 animate-pulse">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                        <span>Extracting Text via Vision OCR...</span>
                      </span>
                    )}
                  </div>

                  {/* Drag/Click Dropzone */}
                  <div
                    onClick={() => attachmentInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-violet-500 rounded-2xl p-5 bg-white hover:bg-violet-50/30 transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 group shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 group-hover:bg-violet-600 text-violet-700 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">
                        Upload Screenshot or Document Image
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium block">
                        Supports PNG, JPG, JPEG, WEBP files for instant text extraction
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs border border-violet-200 mt-1 inline-block">
                      Browse Screenshot / Image
                    </span>
                  </div>

                  {/* Image Previews with Scan OCR Trigger */}
                  {attachedFiles.filter(f => f.type.startsWith('image/')).length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60 text-left">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        Selected Screenshots & Images
                      </span>
                      <div className="grid grid-cols-1 gap-2">
                        {attachedFiles.filter(f => f.type.startsWith('image/')).map((imgFile, idx) => (
                          <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={URL.createObjectURL(imgFile)}
                                alt={imgFile.name}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-800 block truncate max-w-[140px]">
                                  {imgFile.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold block">
                                  {(imgFile.size / 1024).toFixed(0)} KB
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleScanOcr(imgFile)}
                              disabled={isScanningOcr}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                              title="Extract Text / OCR"
                            >
                              {isScanningOcr ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                                  <span>Gemini AI Reading Text...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Scan Image / OCR Extract</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PDF & Document Ingestion Section */}
              {type === 'pdf' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-center">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      PDF & Document Ingestion
                    </span>
                  </div>
                  <div
                    onClick={() => attachmentInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-violet-500 rounded-2xl p-5 bg-white hover:bg-violet-50/30 transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 group shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 group-hover:bg-violet-600 text-violet-700 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">
                        Upload PDF or Document File
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium block">
                        Supports PDF, DOCX, TXT files for automatic text extraction & memory indexing
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs border border-violet-200 mt-1 inline-block">
                      Browse Local PDF / Document
                    </span>
                  </div>
                </div>
              )}

              {/* Live Audio Recorder UI for Voice Memo Format */}
              {type === 'voice' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-center">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Live Voice Memo Recorder
                    </span>
                    {isRecording && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                        <span>Recording Live ({formatRecordingTime(recordingTime)})</span>
                      </span>
                    )}
                    {isTranscribingAudio && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200 animate-pulse">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                        <span>Transcribing audio...</span>
                      </span>
                    )}
                  </div>

                  {micPermissionError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2 text-left">
                      <span>Microphone access was dismissed or unavailable. You can retry or upload an audio file below.</span>
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg font-bold shrink-0 cursor-pointer"
                      >
                        Upload Audio
                      </button>
                    </div>
                  )}

                  {/* Audio Controls */}
                  <div className="flex items-center justify-center gap-4 py-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
                        title="Start Recording"
                      >
                        <Mic className="w-6 h-6" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-lg animate-pulse cursor-pointer"
                        title="Stop Recording"
                      >
                        <Square className="w-6 h-6 fill-current" />
                      </button>
                    )}
                  </div>

                  {audioUrl && (
                    <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border">
                      <div className="flex items-center gap-2 min-w-0">
                        <Volume2 className="w-4 h-4 text-violet-600 shrink-0" />
                        <audio src={audioUrl} controls className="h-8 max-w-[220px]" />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => audioBlob && handleTranscribeAudio(audioBlob)}
                          disabled={isTranscribingAudio}
                          className="px-2.5 py-1 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Transcribe Audio"
                        >
                          <Sparkles className={`w-3 h-3 ${isTranscribingAudio ? 'animate-spin' : ''}`} />
                          <span>{isTranscribingAudio ? 'Transcribing...' : 'Transcribe Audio'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAudioBlob(null); setAudioUrl(null); setAudioTranscriptNotice(null); }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {audioTranscriptNotice && (
                    <div className={`p-2.5 rounded-xl text-xs font-semibold ${audioTranscriptNotice.includes('success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-violet-50 text-violet-800 border border-violet-200'}`}>
                      {audioTranscriptNotice}
                    </div>
                  )}
                </div>
              )}

              {/* Web Article / Resource URL Ingestion Section */}
              {type === 'link' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800">
                        Capture from the Web
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Turn an article or webpage into a searchable memory.
                      </p>
                    </div>
                    {isFetchingLink && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-200 animate-pulse">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                        <span>Analyzing webpage...</span>
                      </span>
                    )}
                    {linkSuccess && !isFetchingLink && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Article Extracted & Summarized</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <LinkIcon className="w-4 h-4 text-violet-600" />
                      </div>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          if (linkError) setLinkError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleFetchLink();
                          }
                        }}
                        placeholder="Paste article or webpage URL (e.g. https://...)"
                        disabled={isFetchingLink}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all disabled:opacity-60"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-slate-400 font-medium">
                        MemoFlow extracts text, synthesizes key facts, and creates searchable takeaways.
                      </p>
                      <button
                        type="button"
                        onClick={handleFetchLink}
                        disabled={isFetchingLink || !url.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        {isFetchingLink ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                            <span>Analyzing webpage...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Ingest & Summarize</span>
                          </>
                        )}
                      </button>
                    </div>

                    {linkError && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2">
                        <span className="shrink-0 text-amber-600 font-bold">Notice:</span>
                        <div className="flex-1">
                          <span>{linkError}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Memory title..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 text-sm font-semibold"
                />
              </div>

              {/* Content Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Content / Notes</label>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-violet-600" />
                    <span>Attach File / Document</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add memory body, extracted text, or transcript notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 text-sm"
                />
              </div>

              {/* Category & Collection Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-violet-600"
                  >
                    {WORKSPACE_CATEGORIES.filter(c => c !== 'All Contexts').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collection</label>
                  <select
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-violet-600"
                  >
                    <option value="general">Auto Infer / General</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachmentSelect}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleManualAudioSelect}
              />

              {/* Footer Save Button */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Save Memory
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}