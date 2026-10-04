'use client'

import React, { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  UploadCloud,
  X,
  Link as LinkIcon,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

export interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  label?: string
  error?: string
  folder?: string
  aspectRatio?: 'square' | 'banner' | 'auto'
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ImageUpload({
  value,
  onChange,
  label = 'Foto / Gambar',
  error,
  folder = 'products',
  aspectRatio = 'square',
  placeholder = 'https://example.com/gambar.jpg',
  disabled = false,
  className,
}: ImageUploadProps) {
  const [tab, setTab] = useState<'file' | 'url'>('file')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [urlInput, setUrlInput] = useState(value || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle upload process
  const uploadFile = async (file: File) => {
    // Validasi ukuran < 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar. Maksimal 5MB.')
      return
    }

    // Validasi tipe file gambar
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diizinkan (JPG, PNG, WebP, GIF, SVG).')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toast.error(json.message || 'Gagal mengunggah gambar')
        return
      }

      const uploadedUrl = json.data.url
      onChange(uploadedUrl)
      setUrlInput(uploadedUrl)
      toast.success('Gambar berhasil diunggah dari perangkat!')
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Koneksi terputus saat mengunggah gambar')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled || isUploading) return

      const file = e.dataTransfer.files?.[0]
      if (file) {
        uploadFile(file)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, isUploading, folder]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleRemove = () => {
    onChange('')
    setUrlInput('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim()
    onChange(trimmed)
    if (trimmed) {
      toast.success('Link gambar diterapkan')
    }
  }

  const isLocalUpload = value?.startsWith('/uploads/')

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{label}</label>
          {value && (
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                isLocalUpload
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              )}
            >
              {isLocalUpload ? '📁 File Lokal' : '🔗 Link URL'}
            </span>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* Preview jika gambar sudah ada */}
      {value ? (
        <div className="relative group rounded-xl border border-border bg-muted/20 overflow-hidden p-2 transition-all">
          <div
            className={cn(
              'relative rounded-lg overflow-hidden bg-muted flex items-center justify-center',
              aspectRatio === 'square' && 'aspect-video sm:aspect-square max-h-48 sm:max-h-44 mx-auto w-full',
              aspectRatio === 'banner' && 'aspect-[21/9] max-h-44 w-full',
              aspectRatio === 'auto' && 'max-h-44 w-full min-h-[120px]'
            )}
          >
            <Image
              src={value}
              alt="Preview gambar"
              fill
              className="object-contain"
              unoptimized={!value.startsWith('/uploads/')}
            />

            {/* Overlay action buttons */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 text-xs font-semibold bg-white/90 hover:bg-white text-zinc-900 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Ganti File
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              >
                <X className="h-3.5 w-3.5" />
                Hapus
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="truncate max-w-[240px] font-mono text-[11px]" title={value}>
              {value}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="text-rose-500 hover:text-rose-600 font-medium shrink-0 ml-2"
            >
              Hapus Gambar
            </button>
          </div>
        </div>
      ) : (
        /* Jika belum ada gambar: Dropzone & Tab Pilihan */
        <div className="space-y-2">
          {/* Tabs Mode */}
          <div className="flex rounded-lg border border-border p-1 bg-muted/30 max-w-fit">
            <button
              type="button"
              onClick={() => setTab('file')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                tab === 'file'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Upload File Perangkat
            </button>
            <button
              type="button"
              onClick={() => setTab('url')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                tab === 'url'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Input Link URL
            </button>
          </div>

          {tab === 'file' ? (
            /* Dropzone Mode */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={cn(
                'relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer select-none',
                isDragging
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10',
                isUploading && 'opacity-60 cursor-not-allowed pointer-events-none'
              )}
            >
              {isUploading ? (
                <div className="py-3 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs font-medium text-foreground">
                    Sedang mengunggah gambar ke server...
                  </p>
                </div>
              ) : (
                <div className="py-2 flex flex-col items-center justify-center gap-2">
                  <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
     
                    <p className="text-xs font-semibold text-foreground">
                      Klik untuk memilih file <span className="font-normal text-muted-foreground">atau seret ke sini</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      JPG, PNG, WebP, GIF, SVG (Maks. 5MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* URL Input Mode */
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleUrlSubmit()
                    }
                  }}
                  placeholder={placeholder}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  className="px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shrink-0"
                >
                  Gunakan URL
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tempelkan URL langsung gambar dari internet (misal: Unsplash, CDN).
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
