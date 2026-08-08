import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Upload, Download, RefreshCw, ImagePlus, ClipboardPaste,
  Check, AlertCircle, Lock, HelpCircle, Pen, Undo2, Eraser,
  Plus, Minus, Maximize2,
} from 'lucide-react'
import { useI18n } from '@/i18n'

const FAQ_ITEMS = [
  { qKey: 'faq.rt.1q', aKey: 'faq.rt.1a' },
  { qKey: 'faq.rt.2q', aKey: 'faq.rt.2a' },
  { qKey: 'faq.rt.3q', aKey: 'faq.rt.3a' },
  { qKey: 'faq.rt.4q', aKey: 'faq.rt.4a' },
  { qKey: 'faq.rt.5q', aKey: 'faq.rt.5a' },
  { qKey: 'faq.rt.6q', aKey: 'faq.rt.6a' },
]

type ProcessState = 'idle' | 'editing' | 'done' | 'error'

export function Retouch() {
  const { t } = useI18n()
  const [state, setState] = useState<ProcessState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [resultSrc, setResultSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [brushSize, setBrushSize] = useState(15)
  const [brushMode, setBrushMode] = useState<'eraser' | 'restore'>('eraser')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalDataRef = useRef<ImageData | null>(null)
  const alphaHistoryRef = useRef<Uint8Array[]>([])
  const isDrawingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clickStartRef = useRef<{ x: number; y: number } | null>(null)

  // 圆形光标
  const [circlePos, setCirclePos] = useState({ x: 0, y: 0 })
  const [circleVisible, setCircleVisible] = useState(false)
  const circleScaleRef = useRef(1)

  const [zoom, setZoom] = useState(1)
  const clampZoom = (v: number) => Math.min(8, Math.max(0.5, v))
  const fitToCanvas = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  const zoomBy = useCallback((d: number) => setZoom((p) => clampZoom(p + d)), [])

  // Alt + 拖拽平移
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [altHeld, setAltHeld] = useState(false)

  // 追踪 Alt 键状态
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltHeld(true) }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Alt') { setAltHeld(false); isPanningRef.current = false; setIsPanning(false) } }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !originalDataRef.current) return
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(originalDataRef.current, 0, 0)
  }, [])

  const paintAt = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current
    if (!canvas || !originalDataRef.current) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((cx - rect.left) * scaleX)
    const y = Math.floor((cy - rect.top) * scaleY)
    const { data, width, height } = originalDataRef.current
    const r = brushSize

    // Save alpha channel for undo
    const prevAlpha = new Uint8Array(width * height)
    for (let i = 0; i < prevAlpha.length; i++) prevAlpha[i] = data[i * 4 + 3]
    alphaHistoryRef.current.push(prevAlpha)

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const pi = (ny * width + nx) * 4
        data[pi + 3] = brushMode === 'eraser' ? 0 : 255
      }
    }
    drawCanvas()
  }, [brushSize, brushMode, drawCanvas])

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
    setState('editing')
  }, [])

  // 等 canvas 挂载后绘制图片
  useEffect(() => {
    if (state !== 'editing' || !originalSrc || !canvasRef.current) return
    const canvas = canvasRef.current
    const img = new Image()
    img.onload = () => {
      const maxDim = 2048
      let w = img.naturalWidth, h = img.naturalHeight
      if (Math.max(w, h) > maxDim) { const r = maxDim / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r) }
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      originalDataRef.current = ctx.getImageData(0, 0, w, h)
      alphaHistoryRef.current = []
      // Force re-render to show canvas content
      canvas.style.display = 'block'
    }
    img.src = originalSrc
  }, [state, originalSrc])

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }, [handleFile])

  const handleReset = () => {
    if (originalSrc) URL.revokeObjectURL(originalSrc)
    if (resultSrc) URL.revokeObjectURL(resultSrc)
    originalDataRef.current = null; alphaHistoryRef.current = []
    setOriginalSrc(null); setResultSrc(null); setState('idle'); setErrorMsg(''); setBrushSize(15); fitToCanvas()
  }

  const handleUndo = () => {
    if (alphaHistoryRef.current.length === 0 || !originalDataRef.current) return
    const prevAlpha = alphaHistoryRef.current.pop()!
    const { data } = originalDataRef.current
    for (let i = 0; i < prevAlpha.length; i++) data[i * 4 + 3] = prevAlpha[i]
    drawCanvas()
  }

  const handleDone = () => {
    if (!canvasRef.current) return
    setResultSrc(canvasRef.current.toDataURL('image/png'))
    setState('done')
  }

  const handleDownload = () => {
    if (!resultSrc) return
    const a = document.createElement('a')
    a.href = resultSrc
    a.download = fileName.replace(/\.[^.]+$/, '') + '-retouch.png'
    a.click()
  }

  const handleBackToEdit = () => {
    setResultSrc(null)
    setState('editing')
  }

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3"><Pen className="w-3 h-3 mr-1" />{t('rt.badge')}</Badge>
          <h1 className="text-3xl font-bold text-slate-900">{t('rt.title')}</h1>
          <p className="mt-2 text-slate-500">{t('rt.subtitle')}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />{t('rt.freeTag')}</div>
        </div>

        {/* Upload */}
        {state === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 hover:border-violet-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-violet-500" /></div>
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

        {/* Editing mode */}
        {state === 'editing' && originalSrc && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-50 text-violet-700 border border-violet-200"><Pen className="w-3 h-3 mr-1" />{t('rt.editBadge')}</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 缩放按钮 */}
                  <div className="flex items-stretch bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => zoomBy(-0.25)}
                      disabled={zoom <= 0.5}
                      className="w-7 h-7 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200"
                      title={t('rb.zoomOut')}
                    ><Minus className="w-3 h-3" /></button>
                    <span className="w-10 h-7 flex items-center justify-center text-xs text-slate-600 bg-slate-50 border-r border-slate-200 select-none">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => zoomBy(0.25)}
                      disabled={zoom >= 8}
                      className="w-7 h-7 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200"
                      title={t('rb.zoomIn')}
                    ><Plus className="w-3 h-3" /></button>
                    <button
                      onClick={fitToCanvas}
                      className="w-7 h-7 flex items-center justify-center text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                      title={t('rb.fit')}
                    ><Maximize2 className="w-3 h-3" /></button>
                  </div>
                  <div className="w-px h-6 bg-slate-200" />{/* divider */}
                  {/* Brush mode toggle */}
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setBrushMode('eraser')} className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${brushMode === 'eraser' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      <Eraser className="w-3.5 h-3.5" />{t('rt.eraser')}
                    </button>
                    <button onClick={() => setBrushMode('restore')} className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${brushMode === 'restore' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      <Undo2 className="w-3.5 h-3.5" />{t('rt.restore')}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">{t('rt.size')}</span>
                    <input type="range" min={2} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-16 accent-violet-500" />
                    <span className="text-xs text-slate-400 w-8">{brushSize}px</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleUndo} disabled={alphaHistoryRef.current.length === 0} className="text-xs gap-1">
                    <Undo2 className="w-3.5 h-3.5" />{t('rb.undo')}
                  </Button>
                </div>
              </div>

              <div className="relative rounded-lg overflow-hidden border border-slate-200 select-none"
                style={{ minHeight: '300px', backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPanning ? 'grabbing' : (zoom > 1 && altHeld ? 'grab' : 'none') }}
                onWheel={(e) => { e.preventDefault(); zoomBy(-e.deltaY / 500) }}
                onMouseDown={(e) => {
                  if (zoom > 1 && e.altKey) {
                    isPanningRef.current = true
                    setIsPanning(true)
                    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
                  } else {
                    clickStartRef.current = { x: e.clientX, y: e.clientY }
                  }
                }}
                onMouseMove={(e) => {
                  const container = e.currentTarget
                  const canvas = canvasRef.current
                  if (canvas) {
                    circleScaleRef.current = canvas.width / canvas.getBoundingClientRect().width
                  }
                  setCirclePos({ x: e.clientX - container.getBoundingClientRect().left, y: e.clientY - container.getBoundingClientRect().top })

                  if (isPanningRef.current) {
                    setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y })
                    return
                  }

                  setCircleVisible(true)
                  if (clickStartRef.current && !isDrawingRef.current) {
                    const dx = e.clientX - clickStartRef.current.x
                    const dy = e.clientY - clickStartRef.current.y
                    if (Math.sqrt(dx * dx + dy * dy) > 3) {
                      isDrawingRef.current = true
                      paintAt(clickStartRef.current.x, clickStartRef.current.y)
                    }
                  }
                  if (isDrawingRef.current) paintAt(e.clientX, e.clientY)
                }}
                onMouseUp={(e) => {
                  if (isPanningRef.current) {
                    isPanningRef.current = false
                    setIsPanning(false)
                    return
                  }
                  if (!isDrawingRef.current && clickStartRef.current) {
                    zoomBy(e.altKey ? -0.25 : 0.25)
                  }
                  isDrawingRef.current = false
                  clickStartRef.current = null
                }}
                onMouseLeave={() => { isDrawingRef.current = false; isPanningRef.current = false; setIsPanning(false); clickStartRef.current = null; setCircleVisible(false) }}
                onTouchStart={(e) => { e.preventDefault(); isDrawingRef.current = true; if (e.touches[0]) paintAt(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchMove={(e) => { e.preventDefault(); if (isDrawingRef.current && e.touches[0]) paintAt(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchEnd={() => { isDrawingRef.current = false }}
              >
                {/* 圆形光标指示器 */}
                {circleVisible && (
                  <div className="absolute pointer-events-none z-30 rounded-full"
                    style={{
                      left: circlePos.x - brushSize / circleScaleRef.current,
                      top: circlePos.y - brushSize / circleScaleRef.current,
                      width: (brushSize * 2) / circleScaleRef.current,
                      height: (brushSize * 2) / circleScaleRef.current,
                      border: `2px solid ${brushMode === 'eraser' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'}`,
                      backgroundColor: brushMode === 'eraser' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                      boxShadow: brushMode === 'eraser' ? '0 0 6px rgba(239, 68, 68, 0.25)' : '0 0 6px rgba(34, 197, 94, 0.25)',
                    }}
                  />
                )}
                {/* 缩放百分比 */}
                {zoom !== 1 && (
                  <div className="absolute top-2 right-2 bg-black/55 text-white/90 text-xs px-2 py-1 rounded-full pointer-events-none z-20 backdrop-blur-sm">
                    {Math.round(zoom * 100)}%
                  </div>
                )}
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', cursor: 'none', transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'center center', willChange: zoom > 1 ? 'transform' : 'auto' }} />
              </div>
              <p className="mt-2 text-xs text-slate-400 text-center">
                {brushMode === 'eraser' ? t('rt.eraseTip') : t('rt.restoreTip')}
              </p>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDone} className="gap-2 bg-violet-600 hover:bg-violet-700"><Check className="w-4 h-4" />{t('rt.done')}</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />{t('rb.reupload')}</Button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <Card className="border-red-100"><CardContent className="py-10"><div className="flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" /><h3 className="font-medium text-slate-700 mb-1">{t('rb.error')}</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />{t('rb.retry')}</Button>
          </div></CardContent></Card>
        )}

        {state === 'done' && resultSrc && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-50 text-green-700 border border-green-200"><Check className="w-3 h-3 mr-1" />{t('rt.doneBadge')}</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
              </div>
              <div className="relative rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]"
                style={{ backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}>
                <img src={resultSrc} alt="Result" className="max-h-[400px] object-contain" />
              </div>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDownload} className="gap-2 bg-violet-600 hover:bg-violet-700"><Download className="w-4 h-4" />{t('rt.download')}</Button>
              <Button variant="outline" onClick={handleBackToEdit} className="gap-2"><Pen className="w-4 h-4" />{t('rt.continue')}</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />{t('rb.reupload')}</Button>
            </div>
            <p className="text-center text-xs text-slate-400">{t('rt.tip')}</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-violet-500" /><h2 className="font-semibold text-slate-800">{t('rt.faqTitle')}</h2></div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-violet-700 hover:no-underline py-4">{t(item.qKey)}</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">{t(item.aKey)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
