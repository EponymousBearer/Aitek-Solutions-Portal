'use client'

import { useCallback } from 'react'

import { Upload, X, FileText } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/utils'

interface UploadedFile {
  file: File
  preview?: string
}

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void
  accept?: Record<string, string[]>
  maxSize?: number
  maxFiles?: number
  files?: UploadedFile[]
  onRemove?: (index: number) => void
  disabled?: boolean
  className?: string
  label?: string
}

export function FileUploadZone({
  onFilesSelected,
  accept = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
  },
  maxSize = 20 * 1024 * 1024, // 20MB default
  maxFiles = 1,
  files = [],
  onRemove,
  disabled = false,
  className,
  label = 'Drop files here or click to browse',
}: FileUploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesSelected(acceptedFiles)
    },
    [onFilesSelected],
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
    disabled,
  })

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, JPG, PNG up to {formatFileSize(maxSize)}
        </p>
      </div>

      {/* Rejection errors */}
      {fileRejections.length > 0 && (
        <div className="rounded-md bg-destructive/10 px-3 py-2">
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} className="text-xs text-destructive">
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{f.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(f.file.size)}</p>
              </div>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemove(i)}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove file</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
