import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageAdapter {
  uploadFile(buffer: Buffer, mimeType: string, filename: string): Promise<{ url: string; storagePath: string }>;
}

/**
 * 1. Local Filesystem Storage Adapter (Fallback / Development)
 */
export class LocalStorageAdapter implements StorageAdapter {
  async uploadFile(buffer: Buffer, mimeType: string, filename: string): Promise<{ url: string; storagePath: string }> {
    const ext = this.getExtensionFromMime(mimeType);
    const uniqueName = `${crypto.randomUUID()}-${filename}.${ext}`;
    
    // Ensure the public/uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    // Return the public web URL and local filesystem storage path
    const url = `/uploads/${uniqueName}`;
    return { url, storagePath: filePath };
  }

  private getExtensionFromMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'audio/ogg': return 'ogg';
      case 'audio/webm': return 'webm';
      case 'audio/mpeg':
      case 'audio/mp3': return 'mp3';
      case 'audio/wav': return 'wav';
      default: return 'bin';
    }
  }
}

/**
 * 2. Cloudinary REST Storage Adapter
 */
export class CloudinaryStorageAdapter implements StorageAdapter {
  private cloudName: string;
  private uploadPreset: string;

  constructor(cloudName: string, uploadPreset: string) {
    this.cloudName = cloudName;
    this.uploadPreset = uploadPreset;
  }

  async uploadFile(buffer: Buffer, mimeType: string, filename: string): Promise<{ url: string; storagePath: string }> {
    const base64Data = buffer.toString('base64');
    const dataURI = `data:${mimeType};base64,${base64Data}`;
    
    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    
    const formData = new URLSearchParams();
    formData.append('file', dataURI);
    formData.append('upload_preset', this.uploadPreset);
    formData.append('public_id', `${crypto.randomUUID()}-${filename}`);

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary upload failed: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    return {
      url: data.secure_url,
      storagePath: data.public_id,
    };
  }
}

/**
 * 3. Supabase REST Storage Adapter
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucket: string;

  constructor(url: string, key: string, bucket: string) {
    this.supabaseUrl = url.replace(/\/$/, ''); // strip trailing slash
    this.supabaseKey = key;
    this.bucket = bucket;
  }

  async uploadFile(buffer: Buffer, mimeType: string, filename: string): Promise<{ url: string; storagePath: string }> {
    const ext = mimeType.split('/')[1] || 'bin';
    const uniquePath = `meal-photos/${crypto.randomUUID()}-${filename}.${ext}`;
    
    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${uniquePath}`;
    
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: new Uint8Array(buffer),
      headers: {
        'Authorization': `Bearer ${this.supabaseKey}`,
        'API-KEY': this.supabaseKey,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase Storage upload failed: ${res.statusText} - ${errText}`);
    }

    // Public URL to retrieve the asset
    const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${uniquePath}`;
    return {
      url: publicUrl,
      storagePath: uniquePath,
    };
  }
}

/**
 * Storage Adapter Factory based on Environment Variables
 */
export function getStorageAdapter(): StorageAdapter {
  const cloudinaryCloud = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudinaryPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (cloudinaryCloud && cloudinaryPreset) {
    console.log('☁️ Using Cloudinary storage adapter.');
    return new CloudinaryStorageAdapter(cloudinaryCloud, cloudinaryPreset);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || 'meals';

  if (supabaseUrl && supabaseKey) {
    console.log('☁️ Using Supabase storage adapter.');
    return new SupabaseStorageAdapter(supabaseUrl, supabaseKey, supabaseBucket);
  }

  console.log('📁 Using local storage adapter (public/uploads).');
  return new LocalStorageAdapter();
}
