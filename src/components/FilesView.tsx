'use client';

import React, { useState, useRef } from 'react';
import { 
  FileText, Image as ImageIcon, Music, Video, File, Upload, 
  Search, Eye, Download, Trash2, Compass, ExternalLink, Paperclip, Link as LinkIcon
} from 'lucide-react';
import { storageService } from '@/lib/services/storageService';
import { Note } from '../mockData';

interface FilesViewProps {
  onOpenQuickCapture?: () => void;
  notes?: Note[];
  onSelectNote?: (noteId: string) => void;
}

export default function FilesView({ onOpenQuickCapture, notes = [], onSelectNote }: FilesViewProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'pdf' | 'images' | 'audio' | 'video' | 'docs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFilesList, setUploadedFilesList] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract file attachments from notes payload
  const noteAttachmentsList = notes.flatMap(n => 
    (n.attachments || []).map((att, idx) => {
      let cat = 'docs';
      if (att.type.includes('pdf')) cat = 'pdf';
      else if (att.type.includes('image')) cat = 'images';
      else if (att.type.includes('audio')) cat = 'audio';
      else if (att.type.includes('video')) cat = 'video';

      return {
        id: att.id || `att-${n.id}-${idx}`,
        name: att.name,
        category: cat,
        size: att.sizeBytes ? `${(att.sizeBytes / 1024).toFixed(0)} KB` : 'Source Asset',
        date: n.savedDate,
        url: att.url,
        noteId: n.id,
        noteTitle: n.title,
        icon: cat === 'pdf' ? FileText : cat === 'images' ? ImageIcon : cat === 'audio' ? Music : cat === 'video' ? Video : File,
        color: cat === 'pdf' ? 'text-rose-600 bg-rose-50 border-rose-200' : cat === 'images' ? 'text-violet-600 bg-violet-50 border-violet-200' : cat === 'audio' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-blue-600 bg-blue-50 border-blue-200'
      };
    })
  );

  const rawAllFiles = [...uploadedFilesList, ...noteAttachmentsList];

  // Deduplicate files by unique file.id to ensure React keys and file items remain unique
  const uniqueFilesMap = new Map<string, any>();
  rawAllFiles.forEach(file => {
    if (file.id && !uniqueFilesMap.has(file.id)) {
      uniqueFilesMap.set(file.id, file);
    }
  });
  const allFiles = Array.from(uniqueFilesMap.values());

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStep(`Uploading ${file.name}...`);

    const stages = [
      { progress: 25, step: `Uploading ${file.name} to storage...` },
      { progress: 50, step: 'Extracting text & running OCR / audio transcription...' },
      { progress: 75, step: 'Generating AI summary & dense embeddings...' },
      { progress: 100, step: 'Upload and AI processing complete!' }
    ];

    let stageIdx = 0;
    const interval = setInterval(() => {
      if (stageIdx < stages.length) {
        setUploadProgress(stages[stageIdx].progress);
        setUploadStep(stages[stageIdx].step);
        stageIdx++;
      } else {
        clearInterval(interval);
        setTimeout(async () => {
          const result = await storageService.uploadFile(file);
          
          let cat = 'docs';
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          if (['pdf'].includes(ext)) cat = 'pdf';
          else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) cat = 'images';
          else if (['mp3', 'wav', 'm4a'].includes(ext)) cat = 'audio';
          else if (['mp4', 'mov', 'webm'].includes(ext)) cat = 'video';

          const formattedSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

          setUploadedFilesList(prev => [
            {
              id: Date.now().toString(),
              name: file.name,
              category: cat,
              size: formattedSize,
              date: 'Just now',
              url: result.url,
              path: result.path,
              icon: cat === 'pdf' ? FileText : cat === 'images' ? ImageIcon : cat === 'audio' ? Music : cat === 'video' ? Video : File,
              color: cat === 'pdf' ? 'text-rose-600 bg-rose-50 border-rose-200' : cat === 'images' ? 'text-violet-600 bg-violet-50 border-violet-200' : cat === 'audio' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-blue-600 bg-blue-50 border-blue-200'
            },
            ...prev
          ]);
          setIsUploading(false);
        }, 400);
      }
    }, 400);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const fileToDelete = uploadedFilesList.find(f => f.id === id);
    if (fileToDelete?.path || fileToDelete?.url) {
      storageService.deleteFile(fileToDelete.path || fileToDelete.url).catch(() => {});
    }
    setUploadedFilesList(prev => prev.filter(f => f.id !== id));
  };

  // Case-insensitive, whitespace-trimmed search query
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredFiles = allFiles.filter(f => {
    const matchCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchSearch = !trimmedSearchQuery || f.name.toLowerCase().includes(trimmedSearchQuery);
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans select-none">
      
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Files
            </h1>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/90 px-2 py-0.5 rounded-full shadow-2xs">
              {allFiles.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Your uploaded documents, images, audio, and other files.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer self-start sm:self-auto active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white/95 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row gap-3 sm:gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative flex items-center w-full md:w-80">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filenames..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-violet-500 font-medium transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'All Files' },
            { id: 'pdf', label: 'PDFs' },
            { id: 'images', label: 'Images' },
            { id: 'audio', label: 'Audio' },
            { id: 'docs', label: 'Documents' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === tab.id
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Uploading Progress */}
      {isUploading && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
          <div className="flex justify-between items-center text-xs font-bold text-violet-900">
            <span>{uploadStep}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-violet-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-violet-600 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Files List / Empty State */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-2xs space-y-3 max-w-md mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center mx-auto shadow-2xs">
            <Compass className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              {allFiles.length === 0 ? 'No files uploaded yet' : 'No source files found'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {allFiles.length === 0
                ? 'Upload local documents or attach files when creating memory notes.'
                : 'Try adjusting your search query or file category filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredFiles.map(file => {
            const IconComp = file.icon || File;
            return (
              <div
                key={file.id}
                className="bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${file.color}`}>
                      <IconComp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-900 truncate group-hover:text-violet-600 transition-colors" title={file.name}>
                        {file.name}
                      </h4>
                      <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
                        {file.size} • {file.date}
                      </span>
                    </div>
                  </div>

                  {/* Subtle Linked Memory Action */}
                  {file.noteTitle && file.noteId && (
                    <button
                      type="button"
                      onClick={() => onSelectNote && onSelectNote(file.noteId)}
                      className="w-full text-left py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-violet-50/70 border border-slate-200/80 hover:border-violet-200 text-slate-600 hover:text-violet-700 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer group/link"
                      title={`View linked memory: ${file.noteTitle}`}
                    >
                      <span className="truncate flex items-center gap-1.5 min-w-0">
                        <LinkIcon className="w-3 h-3 text-slate-400 group-hover/link:text-violet-600 shrink-0" />
                        <span className="text-slate-400 text-[10px] uppercase font-semibold shrink-0">Memory:</span>
                        <span className="truncate font-medium text-slate-700 group-hover/link:text-violet-700">{file.noteTitle}</span>
                      </span>
                      <span className="text-[10px] font-bold text-violet-600 shrink-0 flex items-center gap-0.5 group-hover/link:translate-x-0.5 transition-transform">
                        VIEW →
                      </span>
                    </button>
                  )}
                </div>

                {/* File Action Controls */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      await storageService.downloadFile(file.path || file.url, file.name);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteFile(file.id, e)}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
