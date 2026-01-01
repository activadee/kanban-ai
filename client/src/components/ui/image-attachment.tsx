import * as React from "react"
import { Image as ImageIcon, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { MessageImage } from "shared"

interface ImageAttachmentProps {
  images: MessageImage[]
  variant: "badge" | "thumbnail"
  onRemove?: (index: number) => void
  size?: "sm" | "md"
  className?: string
}

export function ImageAttachment({
  images,
  variant,
  onRemove,
  size = "md",
  className,
}: ImageAttachmentProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [activeImageIndex, setActiveImageIndex] = React.useState(0)

  if (!images || images.length === 0) return null

  const handleOpen = (index: number) => {
    setActiveImageIndex(index)
    setIsOpen(true)
  }

  const getImageSrc = (image: MessageImage) => {
    return `data:${image.mime};base64,${image.data}`
  }

  const badgeSizeClasses = size === "sm" ? "px-2 py-0.5 text-xs h-6" : "px-3 py-1 text-sm h-8"
  const thumbnailSizeClasses = size === "sm" ? "h-16 w-16" : "h-20 w-20"

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {variant === "badge" ? (
          <button
            onClick={() => handleOpen(0)}
            className={cn(
              "group flex items-center gap-1.5 rounded-md bg-secondary/80 px-2 py-1 text-secondary-foreground hover:bg-secondary transition-colors cursor-pointer border border-transparent hover:border-border/50",
              badgeSizeClasses
            )}
            type="button"
          >
            <ImageIcon className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
            <span className="font-medium">
              {images.length} {images.length === 1 ? "Image" : "Images"}
            </span>
          </button>
        ) : (
          images.map((image, index) => (
            <div
              key={`${image.name ?? 'img'}-${image.data.slice(0, 16)}-${index}`}
              className={cn(
                "group relative overflow-hidden rounded-md border border-border bg-muted/50 transition-all hover:border-primary/50",
                thumbnailSizeClasses
              )}
            >
              <button
                type="button"
                onClick={() => handleOpen(index)}
                className="h-full w-full cursor-zoom-in flex items-center justify-center overflow-hidden"
              >
                <img
                  src={getImageSrc(image)}
                  alt={image.name || `Attachment ${index + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
              
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(index)
                  }}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-[2px] transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden border-border bg-background/95 backdrop-blur-sm">
            <DialogHeader className="sr-only">
                <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            
            <div className="relative w-full flex items-center justify-center p-4">
                <img
                    src={getImageSrc(images[activeImageIndex])}
                    alt={images[activeImageIndex].name || "Full size preview"}
                    className="max-h-[80vh] max-w-full object-contain rounded-md"
                />
                
                {images.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-muted/80 rounded-full backdrop-blur-sm border border-border">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveImageIndex(idx)}
                                className={cn(
                                    "h-2 rounded-full transition-all duration-300",
                                    idx === activeImageIndex 
                                        ? "bg-primary w-6" 
                                        : "bg-muted-foreground/40 w-2 hover:bg-muted-foreground/70"
                                )}
                                aria-label={`View image ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
