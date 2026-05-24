import React, { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from '@/components/ui/avatar'
import { Upload, X, Camera } from 'lucide-react'

interface AvatarUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  currentFotoUrl: string | null
  userName: string
  onAvatarUpdated: (fotoUrl: string) => void
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function AvatarUploadDialog({
  open,
  onOpenChange,
  userId,
  currentFotoUrl,
  userName,
  onAvatarUpdated,
}: AvatarUploadDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPreviewUrl(null)
    }
  }, [open])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Formato inválido. Use PNG ou JPG.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 5MB.')
      return
    }

    try {
      const resized = await resizeImage(file, 256)
      setPreviewUrl(resized)
    } catch {
      toast.error('Erro ao processar a imagem.')
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!previewUrl) return

    try {
      setIsUploading(true)
      const result = await window.ipcAPI.user.uploadAvatar(userId, previewUrl)

      if (!result.success) {
        throw new Error(result.error || 'Erro ao salvar avatar')
      }

      toast.success('Foto de perfil atualizada com sucesso!')
      onAvatarUpdated(previewUrl)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar avatar.')
    } finally {
      setIsUploading(false)
    }
  }, [previewUrl, userId, onAvatarUpdated, onOpenChange])

  const handleRemovePreview = useCallback(() => {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const displayUrl = previewUrl || currentFotoUrl
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Foto de Perfil
          </DialogTitle>
          <DialogDescription>
            Escolha uma imagem para o seu avatar. Formatos aceitos: PNG e JPG (máx. 5MB).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative">
            <Avatar className="h-28 w-28">
              <AvatarImage src={displayUrl || undefined} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <AvatarBadge className="h-4 w-4" />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleFileSelect}
          />

          {previewUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Nova imagem selecionada</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRemovePreview}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {currentFotoUrl ? 'Alterar imagem' : 'Selecionar imagem'}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!previewUrl || isUploading}>
            {isUploading ? 'Salvando...' : 'Salvar foto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
