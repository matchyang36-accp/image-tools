import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Upload, Download, RefreshCw, ImagePlus, ClipboardPaste,
  Zap, Check, Loader2, AlertCircle, Lock, HelpCircle, Eraser, Undo2,
} from 'lucide-react'
import { useI18n } from '@/i18n'

const FAQ_ITEMS = [
  { qKey: 'faq.wm.1q', aKey: 'faq.wm.1a' },
  { qKey: 'faq.wm.2q', aKey: 'faq.wm.2a' },
  { qKey: 'faq.wm.3q', aKey: 'faq.wm.3a' },
  { qKey: 'faq.wm.4q', aKey: 'faq.wm.4a' },
  { qKey: 'faq.wm.5q', aKey: 'faq.wm.5a' },
  { qKey: 'faq.wm.6q', aKey: 'faq.wm.6a' },
]

type ProcessState = 'idle' | 'marking' | 'processing' | 'done' | 'error'

function inpaint(imageData: ImageData, mask: Uint8Array): ImageData {
  const { data, width, height } = imageData
  const result = new Uint8ClampedArray(data)
  const radius = 6

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x)
      if (!mask[idx]) continue

      let r = 0, g = 0, b = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          if (mask[ny * width + nx]) continue
          const ni = (ny * width + nx) * 4
          r += data[ni]; g += data[ni + 1]; b += data[ni + 2]; count++
        }
      }
      const pi = idx * 4
      if (count > 0) {
        result[pi] = r / count; result[pi + 1] = g / count; result[pi + 2] = b / count
      }
    }
  }
  return new ImageData(result, width, height)
}

export function Watermark() {
  const { t } = useI18n()
  const [state, setState] = useState<ProcessState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [resultSrc, setResultSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [brushSize, setBrushSize] = useState(20)

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const maskRef = useRef<Uint8Array | null>(null)
  const maskHistoryRef = useRef<Uint8Array[]>([])
  const isDrawingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const fitToCanvas = useCallback(() => {}, [])

  const drawMaskOnCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageDataRef.current || !maskRef.current) return
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageDataRef.current, 0, 0)
    // Overlay mask in red
    const overlay = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < maskRef.current.length; i++) {
      if (maskRef.current[i]) {
        overlay.data[i * 4] = 200; overlay.data[i * 4 + 1] = 50; overlay.data[i * 4 + 2] = 50; overlay.data[i * 4 + 3] = 120
      }
    }
    ctx.putImageData(overlay, 0, 0)
  }, [])

  const paintAt = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current
    if (!canvas || !maskRef.current) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((cx - rect.left) * scaleX)
    const y = Math.floor((cy - rect.top) * scaleY)
    const w = canvas.width, h = canvas.height
    const r = brushSize

    // Save history
    maskHistoryRef.current.push(new Uint8Array(maskRef.current))

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        maskRef.current[ny * w + nx] = 1
      }
    }
    drawMaskOnCanvas()
  }, [brushSize, drawMaskOnCanvas])

  const handlePasteCallback = useCallback((e: ClipboardEvent) => {
    if (state !== 'idle') return
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) { handleFile(f); break } }
    }
  }, [state])
  useEffect(() => { document.addEventListener('paste', handlePasteCallback); return () => document.removeEventListener('paste', handlePasteCallback) }, [handlePasteCallback])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setOriginalSrc(url); setResultSrc(null); setFileName(file.name); setErrorMsg('')
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Limit max dimension to 2048 for performance
      const maxDim = 2048
      let w = img.naturalWidth, h = img.naturalHeight
      if (Math.max(w, h) > maxDim) {
        const ratio = maxDim / Math.max(w, h); w = Math.round(w * ratio); h = Math.round(h * ratio)
      }
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const idata = ctx.getImageData(0, 0, w, h)
      imageDataRef.current = idata
      maskRef.current = new Uint8Array(w * h)
      maskHistoryRef.current = []
      setTimeout(() => {
        const dc = canvasRef.current
        if (dc) { dc.width = w; dc.height = h; drawMaskOnCanvas() }
      }, 50)
      setState('marking')
    }
    img.src = url
  }, [drawMaskOnCanvas])

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }, [handleFile])

  const handleReset = () => {
    if (originalSrc) URL.revokeObjectURL(originalSrc)
    if (resultSrc) URL.revokeObjectURL(resultSrc)
    imageDataRef.current = null; maskRef.current = null; maskHistoryRef.current = []
    setOriginalSrc(null); setResultSrc(null); setState('idle'); setErrorMsg(''); setBrushSize(20); fitToCanvas()
  }

  const handleUndo = () => {
    if (maskHistoryRef.current.length === 0 || !maskRef.current) return
    maskRef.current = maskHistoryRef.current.pop()!
    drawMaskOnCanvas()
  }

  const handleClearMask = () => {
    if (!maskRef.current || !canvasRef.current) return
    maskHistoryRef.current.push(new Uint8Array(maskRef.current))
    maskRef.current.fill(0)
    drawMaskOnCanvas()
  }

  const handleProcess = () => {
    if (!imageDataRef.current || !maskRef.current) return
    // Check if any mask exists
    if (maskRef.current.every((v) => v === 0)) { setErrorMsg(t('wm.markEmpty')); return }
    setState('processing')
    setTimeout(() => {
      try {
        const result = inpaint(imageDataRef.current!, maskRef.current!)
        const canvas = document.createElement('canvas')
        canvas.width = result.width; canvas.height = result.height
        canvas.getContext('2d')!.putImageData(result, 0, 0)
        setResultSrc(canvas.toDataURL('image/png'))
        setState('done')
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : t('rb.error'))
        setState('error')
      }
    }, 300)
  }

  const handleDownload = () => {
    if (!resultSrc) return
    const a = document.createElement('a')
    a.href = resultSrc
    a.download = fileName.replace(/\.[^.]+$/, '') + '-nowm.png'
    a.click()
  }

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3"><Zap className="w-3 h-3 mr-1" />{t('wm.badge')}</Badge>
          <h1 className="text-3xl font-bold text-slate-900">{t('wm.title')}</h1>
          <p className="mt-2 text-slate-500">{t('wm.subtitle')}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />{t('wm.freeTag')}</div>
        </div>

        {/* Upload */}
        {state === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-emerald-500" /></div>
              <h3 className="text-lg font-medium text-slate-700 mb-1">{t('upload.title')}</h3>
              <p className="text-sm text-slate-400 mb-4">{t('upload.desc')}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><ImagePlus className="w-3 h-3" /> {t('upload.fmt')}</span>
                <span className="flex items-center gap-1"><ClipboardPaste className="w-3 h-3" /> {t('upload.paste')}</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100"><Lock className="w-3 h-3 text-green-500" />{t('upload.privacyShort')}</div>
            </CardContent>
          </Card>
        )}

        {/* Marking mode */}
        {state === 'marking' && originalSrc && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200"><Eraser className="w-3 h-3 mr-1" />{t('wm.markBadge')}</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">{t('wm.brush')}</span>
                    <input type="range" min={5} max={80} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-20 accent-emerald-500" />
                    <span className="text-xs text-slate-400 w-6">{brushSize}px</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleUndo} disabled={maskHistoryRef.current.length === 0} className="text-xs gap-1">
                    <Undo2 className="w-3.5 h-3.5" />{t('wm.undo')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearMask} className="text-xs text-red-500 hover:text-red-600">{t('wm.clear')}</Button>
                </div>
              </div>

              <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-slate-200 bg-grid cursor-crosshair select-none"
                onMouseDown={(e) => { isDrawingRef.current = true; paintAt(e.clientX, e.clientY) }}
                onMouseMove={(e) => { if (isDrawingRef.current) paintAt(e.clientX, e.clientY) }}
                onMouseUp={() => { isDrawingRef.current = false }}
                onMouseLeave={() => { isDrawingRef.current = false }}
                onTouchStart={(e) => { e.preventDefault(); isDrawingRef.current = true; if (e.touches[0]) paintAt(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchMove={(e) => { e.preventDefault(); if (isDrawingRef.current && e.touches[0]) paintAt(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchEnd={() => { isDrawingRef.current = false }}
                style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
              </div>
              <p className="mt-2 text-xs text-slate-400 text-center">{t('wm.markHint')}</p>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleProcess} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Zap className="w-4 h-4" />{t('wm.process')}</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />{t('rb.reupload')}</Button>
            </div>
          </div>
        )}

        {state === 'processing' && (
          <Card><CardContent className="py-12"><div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
            <h3 className="font-medium text-slate-700">{t('wm.processing')}</h3>
            <p className="text-sm text-slate-400 mt-1">{t('wm.processingDesc')}</p>
          </div></CardContent></Card>
        )}

        {state === 'error' && (
          <Card className="border-red-100"><CardContent className="py-10"><div className="flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" /><h3 className="font-medium text-slate-700 mb-1">{t('wm.opTip')}</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setErrorMsg(''); setState('marking') }} className="gap-2"><Undo2 className="w-4 h-4" />{t('wm.backToMark')}</Button>
              <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />{t('rb.reupload')}</Button>
            </div>
          </div></CardContent></Card>
        )}

        {state === 'done' && resultSrc && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-50 text-green-700 border border-green-200"><Check className="w-3 h-3 mr-1" />{t('rb.done')}</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
              </div>
              <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-grid min-h-[300px]">
                <img src={resultSrc} alt="Result" className="max-h-[400px] object-contain" />
              </div>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDownload} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Download className="w-4 h-4" />{t('wm.download')}</Button>
              <Button variant="outline" onClick={() => { setState('marking'); setResultSrc(null) }} className="gap-2"><Undo2 className="w-4 h-4" />{t('wm.continueEdit')}</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />{t('rb.reupload')}</Button>
            </div>
            <p className="text-center text-xs text-slate-400">{t('wm.doneTip')}</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-emerald-500" /><h2 className="font-semibold text-slate-800">{t('wm.faqTitle')}</h2></div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-emerald-700 hover:no-underline py-4">{t(item.qKey)}</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">{t(item.aKey)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
