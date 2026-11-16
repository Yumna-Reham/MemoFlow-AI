import { createClient } from '../supabase/client';

export interface StorageMetrics {
  usedBytes: number;
  formattedUsed: string;
  totalGigabytes: number;
  percentage: number;
}

export interface IStorageProvider {
  uploadFile(file: File, folder?: string): Promise<{ url: string; path: string; size: number }>;
  getSignedUrl(pathOrUrl: string, expiresIn?: number, downloadOption?: string | boolean): Promise<string>;
  downloadFile(pathOrUrl: string, customFilename?: string): Promise<boolean>;
  deleteFile(pathOrUrl: string): Promise<boolean>;
  extractPath(pathOrUrl: string): string | null;
  calculateUsage(notes: any[]): Promise<StorageMetrics>;
}

export const storageService: IStorageProvider = {
  extractPath(pathOrUrl: string): string | null {
    if (!pathOrUrl || pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
      return null;
    }
    // Match Supabase storage URL: /storage/v1/object/(public|sign)/memoflow-files/<path>
    const match = pathOrUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/memoflow-files\/([^?#]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    // If it is already a relative path containing slashes (e.g. <user_id>/<folder>/<filename> or <folder>/<filename>)
    if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://') && pathOrUrl.includes('/')) {
      return pathOrUrl;
    }
    return null;
  },

  async uploadFile(file: File, folder: string = 'memories'): Promise<{ url: string; path: string; size: number }> {
    try {
      const supabase = createClient() as any;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user || userError) {
        throw new Error('Authentication required to upload files.');
      }

      // Sanitize folder: alphanumeric, hyphens, and underscores only
      const safeFolder = (folder || 'memories').replace(/[^a-zA-Z0-9_-]/g, '') || 'memories';

      // Sanitize filename: prevent path traversal and normalize characters
      const originalName = file.name || 'file';
      const ext = (originalName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawBase = originalName.lastIndexOf('.') > 0 
        ? originalName.substring(0, originalName.lastIndexOf('.'))
        : originalName;
      const safeBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeBase ? `_${safeBase}` : ''}.${ext || 'bin'}`;

      // Storage path strictly rooted under authenticated user's ID
      const filePath = `${user.id}/${safeFolder}/${safeFileName}`;

      const { data, error } = await supabase.storage
        .from('memoflow-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (error) {
        console.warn('Supabase storage upload fallback:', error.message);
        // Fallback to Data URL for instant local preview if bucket or network issues occur
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              url: reader.result as string,
              path: filePath,
              size: file.size,
            });
          };
          reader.readAsDataURL(file);
        });
      }

      // Generate private signed URL with 7 days (604800s) validity
      const { data: signedData, error: signError } = await supabase.storage
        .from('memoflow-files')
        .createSignedUrl(filePath, 604800);

      if (signError || !signedData?.signedUrl) {
        console.warn('Signed URL generation warning:', signError?.message);
      }

      return {
        url: signedData?.signedUrl || filePath,
        path: filePath,
        size: file.size,
      };
    } catch (err: any) {
      console.warn('storageService.uploadFile warning:', err?.message || err);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            url: reader.result as string,
            path: `fallback/${file.name}`,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      });
    }
  },

  async getSignedUrl(pathOrUrl: string, expiresIn: number = 604800, downloadOption?: string | boolean): Promise<string> {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
      return pathOrUrl;
    }

    const path = this.extractPath(pathOrUrl);
    if (!path) {
      return pathOrUrl;
    }

    try {
      const supabase = createClient() as any;
      const options: any = {};
      if (downloadOption) {
        options.download = downloadOption;
      }
      const { data, error } = await supabase.storage
        .from('memoflow-files')
        .createSignedUrl(path, expiresIn, options);

      if (error || !data?.signedUrl) {
        return pathOrUrl;
      }
      return data.signedUrl;
    } catch (err) {
      return pathOrUrl;
    }
  },

  async downloadFile(pathOrUrl: string, customFilename?: string): Promise<boolean> {
    if (!pathOrUrl) return false;
    const path = this.extractPath(pathOrUrl);
    const filename = customFilename || (path ? path.split('/').pop() : 'download');

    try {
      // 1. Direct authenticated download via Supabase Storage API
      if (path) {
        const supabase = createClient() as any;
        const { data: blob, error } = await supabase.storage
          .from('memoflow-files')
          .download(path);

        if (!error && blob) {
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.download = filename || 'download';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
          }, 200);
          return true;
        }
      }

      // 2. Fallback: Generate time-limited signed URL with Content-Disposition: attachment
      const signedUrl = await this.getSignedUrl(pathOrUrl, 300, filename);
      if (signedUrl) {
        try {
          const res = await fetch(signedUrl);
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              if (document.body.contains(a)) document.body.removeChild(a);
              window.URL.revokeObjectURL(blobUrl);
            }, 200);
            return true;
          }
        } catch (fetchErr) {
          console.warn('[MEMOFLOW STORAGE] Fetch blob fallback to navigation:', fetchErr);
        }

        // Direct anchor navigation with &download= parameter
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
        }, 200);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[MEMOFLOW STORAGE] downloadFile error:', err);
      return false;
    }
  },

  async deleteFile(pathOrUrl: string): Promise<boolean> {
    if (!pathOrUrl) return false;
    const path = this.extractPath(pathOrUrl);
    if (!path) return false;

    try {
      const supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        console.warn('deleteFile refused: user unauthenticated');
        return false;
      }

      // Strict user isolation check: first segment of path must match user.id
      const pathOwnerId = path.split('/')[0];
      if (pathOwnerId !== user.id) {
        console.error('deleteFile forbidden: cannot delete file belonging to another user');
        return false;
      }

      const { error } = await supabase.storage
        .from('memoflow-files')
        .remove([path]);

      if (error) {
        console.warn('deleteFile error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('storageService.deleteFile warning:', err);
      return false;
    }
  },

  async calculateUsage(notes: any[]): Promise<StorageMetrics> {
    try {
      let totalBytes = 0;
      (notes || []).forEach((note) => {
        const contentLen = note.content ? new Blob([note.content]).size : 0;
        const summaryLen = note.summary ? new Blob([note.summary]).size : 0;
        let attachmentBytes = 0;
        if (Array.isArray(note.attachments)) {
          note.attachments.forEach((a: any) => {
            const sz = a.sizeBytes ?? a.size;
            if (typeof sz === 'number') {
              attachmentBytes += sz;
            } else if (typeof sz === 'string') {
              const num = parseFloat(sz);
              const lower = sz.toLowerCase();
              if (lower.includes('gb')) attachmentBytes += num * 1024 * 1024 * 1024;
              else if (lower.includes('mb')) attachmentBytes += num * 1024 * 1024;
              else if (lower.includes('kb')) attachmentBytes += num * 1024;
              else if (!isNaN(num)) attachmentBytes += num;
            }
          });
        }
        totalBytes += contentLen + summaryLen + attachmentBytes + 2048; // Base note metadata overhead ~2KB
      });

      const totalGB = 5.0; // Free Tier allocation 5GB
      const percent = Math.min(Math.round((totalBytes / (5.0 * 1024 * 1024 * 1024)) * 100), 100);

      let formattedUsed = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
      if (totalBytes < 1024 * 1024) {
        formattedUsed = `${(totalBytes / 1024).toFixed(1)} KB`;
      } else if (totalBytes >= 1024 * 1024 * 1024) {
        formattedUsed = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      }

      return {
        usedBytes: totalBytes,
        formattedUsed,
        totalGigabytes: totalGB,
        percentage: Math.max(percent, 1),
      };
    } catch (e) {
      return {
        usedBytes: 0,
        formattedUsed: '0 KB',
        totalGigabytes: 5.0,
        percentage: 1,
      };
    }
  },
};
