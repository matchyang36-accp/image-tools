import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Upload, Download, RefreshCw, ImagePlus,
  ClipboardPaste, Sparkles, Check,
  Loader2, AlertCircle, Lock, HelpCircle, Image as ImageIcon,
} from 'lucide-react'
import { removeBackground } from '@imgly/background-removal'
import { useI18n } from '@/i18n'

const FAQ_ITEMS = [
  { qKey: 'faq.wb.1q', aKey: 'faq.wb.1a' },
  { qKey: 'faq.wb.2q', aKey: 'faq.wb.2a' },
  { qKey: 'faq.wb.3q', aKey: 'faq.wb.3a' },
  { qKey: 'faq.wb.4q', aKey: 'faq.wb.4a' },
  { qKey: 'faq.wb.5q', aKey: 'faq.wb.5a' },
  { qKey: 'faq.wb.6q', aKey: 'faq.wb.6a' },
]

type ProcessState = 'idle' | 'processing' | 'compositing' | 'done' | 'error'

interface ProcessResult {
  original: string
  result: string | null
  transparent: string | null
  fileName: string
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 8
const ZOOM_STEP = 0.25

export function WhiteBg() {
  const { t } = useI18n()
  const [state, setState] = useState<ProcessState>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [compareMode, setCompareMode] = useState<'result' | 'original'>('result')
  const [bgColor, setBgColor] = useState('#FFFFFF')

  // 缩放 & 平移
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const wheelRafRef = useRef(0)
  const pendingZoomRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))
  const fitToCanvas = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  useEffect(() => { fitToCanvas() }, [compareMode, fitToCanvas])

  const zoomBy = useCallback((delta: number) => {
    setZoom((prev) => clampZoom(prev + delta))
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    pendingZoomRef.current = clampZoom(zoom + (-e.deltaY / 400))
    if (!wheelRafRef.current) {
      wheelRafRef.current = requestAnimationFrame(() => {
        setZoom(pendingZoomRef.current)
        wheelRafRef.current = 0
      })
    }
  }, [zoom])

  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    if (zoom <= 1) return
    isPanningRef.current = true
    panStartRef.current = { x: clientX, y: clientY, panX: pan.x, panY: pan.y }
  }, [pan, zoom])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      setPan({ x: panStartRef.current.panX + (e.clientX - panStartRef.current.x), y: panStartRef.current.panY + (e.clientY - panStartRef.current.y) })
    }
    const onUp = () => { isPanningRef.current = false }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // 移动端双指捏合
  useEffect(() => {
    const vp = viewportRef.current; if (!vp) return
    let pinchStart = { dist: 0, zoom: 1 }
    const getDist = (touches: TouchList) => {
      if (touches.length < 2) return 0
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }
    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 2) pinchStart = { dist: getDist(e.touches), zoom }
    }
    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart.dist > 0) {
        setZoom(clampZoom(pinchStart.zoom * (getDist(e.touches) / pinchStart.dist)))
      }
    }
    vp.addEventListener('touchstart', onTS, { passive: true })
    vp.addEventListener('touchmove', onTM, { passive: true })
    return () => { vp.removeEventListener('touchstart', onTS); vp.removeEventListener('touchmove', onTM) }
  }, [zoom])

  const handlePasteCallback = useCallback((e: ClipboardEvent) => {
    if (state !== 'idle') return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) { handleFile(file); break }
      }
    }
  }, [state])
  useEffect(() => { document.addEventListener('paste', handlePasteCallback); return () => document.removeEventListener('paste', handlePasteCallback) }, [handlePasteCallback])

  const compositeWhiteBg = useCallback(async (blob: Blob): Promise<Blob> => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
  }, [bgColor])

  const processImage = useCallback(async (file: File) => {
    const originalUrl = URL.createObjectURL(file)
    setResult({ original: originalUrl, result: null, transparent: null, fileName: file.name })
    setErrorMsg('')
    setState('processing')
    setProgress(10)

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 8, 85))
    }, 800)

    try {
      const blob = await removeBackground(file)
      clearInterval(progressInterval)
      const transparentUrl = URL.createObjectURL(blob)

      setProgress(90)
      setState('compositing')

      const whiteBgBlob = await compositeWhiteBg(blob)
      const resultUrl = URL.createObjectURL(whiteBgBlob)

      setProgress(100)
      setResult((prev) => prev ? { ...prev, result: resultUrl, transparent: transparentUrl } : null)
      setState('done')
    } catch (err: unknown) {
      clearInterval(progressInterval)
      setErrorMsg(err instanceof Error ? err.message : t('rb.error'))
      setState('error')
    }
  }, [compositeWhiteBg, t])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    processImage(file)
  }, [processImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleReset = () => {
    if (result?.original) URL.revokeObjectURL(result.original)
    if (result?.result) URL.revokeObjectURL(result.result)
    if (result?.transparent) URL.revokeObjectURL(result.transparent)
    setResult(null); setState('idle'); setProgress(0); setErrorMsg(''); setCompareMode('result'); fitToCanvas()
  }

  const handleDownload = async (format: 'jpg' | 'png') => {
    if (!result?.result && !result?.transparent) return
    if (format === 'png' && result.transparent) {
      const a = document.createElement('a')
      a.href = result.transparent
      a.download = result.fileName.replace(/\.[^.]+$/, '') + '-nobg.png'
      a.click()
      return
    }
    // JPG with white bg
    const img = new Image()
    await new Promise<void>((r) => { img.onload = () => r(); img.src = result.result! })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    canvas.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = result.fileName.replace(/\.[^.]+$/, '') + '-whitebg.' + format
      a.click()
    }, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95)
  }

  const bgColors = ['#FFFFFF', '#F5F5F5', '#E8E8E8', '#D4D4D4', '#00A650', '#FF6B35', '#4A90D9', '#FFD700']

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3"><ImageIcon className="w-3 h-3 mr-1" />{t('wb.badge')}</Badge>
          <h1 className="text-3xl font-bold text-slate-900">{t('wb.title')}</h1>
          <p className="mt-2 text-slate-500">{t('wb.subtitle')}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />{t('rb.freeTag')}</div>
        </div>

        {state === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-blue-500" /></div>
              <h3 className="text-lg font-medium text-slate-700 mb-1">{t('upload.title')}</h3>
              <p className="text-sm text-slate-400 mb-4">{t('upload.desc')}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><ImagePlus className="w-3 h-3" /> {t('upload.fmt')}</span>
                <span className="flex items-center gap-1"><ClipboardPaste className="w-3 h-3" /> {t('upload.paste')}</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <Lock className="w-3 h-3 text-green-500 flex-shrink-0" />{t('upload.privacyShort')}
              </div>
            </CardContent>
          </Card>
        )}

        {(state === 'processing' || state === 'compositing') && result && (
          <Card><CardContent className="py-12"><div className="flex flex-col items-center">
            <div className="relative mb-4"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /><Sparkles className="w-5 h-5 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
            <h3 className="font-medium text-slate-700">{state === 'processing' ? t('wb.processing') : t('wb.compositing')}</h3>
            <p className="text-sm text-slate-400 mt-1">{state === 'processing' ? (progress < 30 ? t('wb.loadingModel') : t('wb.removing')) : t('wb.compositingDesc')}</p>
            <div className="w-64 mt-4"><Progress value={progress} className="h-1.5" /></div>
            <p className="text-xs text-slate-400 mt-2">{Math.round(progress)}%</p>
          </div></CardContent></Card>
        )}

        {state === 'error' && (
          <Card className="border-red-100"><CardContent className="py-10"><div className="flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" /><h3 className="font-medium text-slate-700 mb-1">{t('rb.error')}</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />{t('rb.retry')}</Button>
          </div></CardContent></Card>
        )}

        {state === 'done' && result && (
          <div className="space-y-4">
            {/* Background color picker */}
            <Card><CardContent className="p-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{t('wb.bgColor')}</span>
                <div className="flex gap-1.5">
                  {bgColors.map((c) => (
                    <button key={c} onClick={() => setBgColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                      style={{ backgroundColor: c, borderColor: bgColor === c ? '#6366f1' : '#e2e8f0', boxShadow: bgColor === c ? '0 0 0 2px rgba(99,102,241,0.3)' : 'none' }} />
                  ))}
                  <div className="relative">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                      className="w-7 h-7 rounded-full border-2 border-slate-200 cursor-pointer opacity-0 absolute inset-0" />
                    <div className="w-7 h-7 rounded-full border-2 border-slate-200 flex items-center justify-center bg-white text-xs text-slate-400">…</div>
                  </div>
                </div>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-50"><Check className="w-3 h-3 mr-1" />{t('rb.done')}</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{result.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-stretch bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <button onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200" title={t('rb.zoomOut')}>−</button>
                    <span className="w-12 h-8 flex items-center justify-center text-xs text-slate-600 bg-slate-50 border-r border-slate-200 select-none">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200" title={t('rb.zoomIn')}>+</button>
                    <button onClick={fitToCanvas} className="w-8 h-8 flex items-center justify-center text-sm text-slate-500 hover:bg-slate-50 transition-colors" title={t('rb.fit')}>⊡</button>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    {([{ key: 'result', label: t('wb.modeWhite') }, { key: 'original', label: t('wb.modeOriginal') }] as const).map((opt) => (
                      <button key={opt.key} onClick={() => setCompareMode(opt.key)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${compareMode === opt.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div ref={viewportRef}
                className="relative rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center select-none touch-none"
                style={{ backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`, backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px', cursor: zoom > 1 ? (isPanningRef.current ? 'grabbing' : 'grab') : 'zoom-in' }}
                onWheel={handleWheel}
                onMouseDown={(e) => { e.preventDefault(); handlePanStart(e.clientX, e.clientY) }}
                onDoubleClick={fitToCanvas}
              >
                <div style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out', willChange: 'transform' }}>
                  {compareMode === 'original' ? (
                    <img src={result.original} alt="Original" className="max-h-[400px] object-contain pointer-events-none" draggable={false} />
                  ) : (
                    <div className="relative inline-block">
                      <img src={result.result!} alt="White Background" className="max-h-[400px] object-contain pointer-events-none" draggable={false} />
                    </div>
                  )}
                </div>
                {zoom > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/55 text-white/90 text-xs px-2.5 py-1 rounded-full pointer-events-none z-20 backdrop-blur-sm">{t('rb.zoomHint')}</div>
                )}
              </div>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => handleDownload('jpg')} className="gap-2 bg-blue-600 hover:bg-blue-700"><Download className="w-4 h-4" />{t('wb.downloadJpg')}</Button>
              <Button onClick={() => handleDownload('png')} variant="outline" className="gap-2"><Download className="w-4 h-4" />{t('wb.downloadPng')}</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />{t('rb.reupload')}</Button>
            </div>
            <p className="text-center text-xs text-slate-400">{t('wb.tip')}</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-slate-800">{t('wb.faqTitle')}</h2></div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:no-underline py-4">{t(item.qKey)}</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">{t(item.aKey)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
