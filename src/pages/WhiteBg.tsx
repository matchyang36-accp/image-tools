import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Upload, Download, RefreshCw, ImagePlus,
  ClipboardPaste, Sparkles, Check,
  Loader2, AlertCircle, Lock, HelpCircle, Image,
} from 'lucide-react'
import { removeBackground } from '@imgly/background-removal'

const FAQ_ITEMS = [
  { q: '白底图和普通抠图有什么区别？', a: '普通抠图输出透明背景 PNG，白底图则是在抠图后自动合成纯白背景，适合直接用于淘宝/京东等电商平台。' },
  { q: '支持哪些图片格式？', a: '支持 JPG、JPEG、PNG、WebP 格式。处理后可下载 JPG（白底）或 PNG（透明底）。' },
  { q: '图片会上传到服务器吗？', a: '完全不会。所有处理都在你的浏览器本地完成，图片数据不会离开你的设备。' },
  { q: '白底图尺寸和质量如何？', a: '输出图片保持原始分辨率，不会压缩画质。如果你需要调整尺寸，可以下载后用系统自带工具裁剪。' },
  { q: '抠图效果不好怎么办？', a: '建议使用背景与主体色差较大的照片。后续将上线「手动精修」功能，支持手动涂抹修复边缘。' },
  { q: '支持批量处理吗？', a: '批量处理功能即将上线，支持一次上传多张图片同时处理。' },
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

  const compositeWhiteBg = useCallback(async (blob: Blob, file: File): Promise<Blob> => {
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

      const whiteBgBlob = await compositeWhiteBg(blob, file)
      const resultUrl = URL.createObjectURL(whiteBgBlob)

      setProgress(100)
      setResult((prev) => prev ? { ...prev, result: resultUrl, transparent: transparentUrl } : null)
      setState('done')
    } catch (err: unknown) {
      clearInterval(progressInterval)
      setErrorMsg(err instanceof Error ? err.message : '处理失败，请重试')
      setState('error')
    }
  }, [compositeWhiteBg])

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
          <Badge variant="secondary" className="mb-3"><Image className="w-3 h-3 mr-1" />AI 白底图</Badge>
          <h1 className="text-3xl font-bold text-slate-900">免费在线生成电商白底图</h1>
          <p className="mt-2 text-slate-500">上传图片，AI 自动抠图并合成纯白背景，适配淘宝/京东/拼多多</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />100% 免费 · 本地 AI 处理 · 无需注册</div>
        </div>

        {state === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-blue-500" /></div>
              <h3 className="text-lg font-medium text-slate-700 mb-1">上传图片</h3>
              <p className="text-sm text-slate-400 mb-4">拖拽文件到此处，或点击上传 / Ctrl+V 粘贴</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><ImagePlus className="w-3 h-3" /> JPG / PNG / WebP</span>
                <span className="flex items-center gap-1"><ClipboardPaste className="w-3 h-3" /> 支持粘贴</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <Lock className="w-3 h-3 text-green-500 flex-shrink-0" />图片仅在本地处理，不上传服务器
              </div>
            </CardContent>
          </Card>
        )}

        {(state === 'processing' || state === 'compositing') && result && (
          <Card><CardContent className="py-12"><div className="flex flex-col items-center">
            <div className="relative mb-4"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /><Sparkles className="w-5 h-5 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
            <h3 className="font-medium text-slate-700">{state === 'processing' ? 'AI 正在抠图中...' : '正在合成白底...'}</h3>
            <p className="text-sm text-slate-400 mt-1">{state === 'processing' ? (progress < 30 ? '首次使用需加载 AI 模型（约40MB），之后会缓存' : '智能识别并移除背景') : '将抠图结果合成到白色背景上'}</p>
            <div className="w-64 mt-4"><Progress value={progress} className="h-1.5" /></div>
            <p className="text-xs text-slate-400 mt-2">{Math.round(progress)}%</p>
          </div></CardContent></Card>
        )}

        {state === 'error' && (
          <Card className="border-red-100"><CardContent className="py-10"><div className="flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" /><h3 className="font-medium text-slate-700 mb-1">处理失败</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />重试</Button>
          </div></CardContent></Card>
        )}

        {state === 'done' && result && (
          <div className="space-y-4">
            {/* Background color picker */}
            <Card><CardContent className="p-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">背景颜色：</span>
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
                  <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-50"><Check className="w-3 h-3 mr-1" />处理完成</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{result.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-stretch bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <button onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200" title="缩小">−</button>
                    <span className="w-12 h-8 flex items-center justify-center text-xs text-slate-600 bg-slate-50 border-r border-slate-200 select-none">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200" title="放大">+</button>
                    <button onClick={fitToCanvas} className="w-8 h-8 flex items-center justify-center text-sm text-slate-500 hover:bg-slate-50 transition-colors" title="适应画布">⊡</button>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    {([{ key: 'result', label: '白底图' }, { key: 'original', label: '原图' }] as const).map((opt) => (
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
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/55 text-white/90 text-xs px-2.5 py-1 rounded-full pointer-events-none z-20 backdrop-blur-sm">双击适应画布 · 拖拽平移</div>
                )}
              </div>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => handleDownload('jpg')} className="gap-2 bg-blue-600 hover:bg-blue-700"><Download className="w-4 h-4" />下载白底 JPG</Button>
              <Button onClick={() => handleDownload('png')} variant="outline" className="gap-2"><Download className="w-4 h-4" />下载透明 PNG</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />重新上传</Button>
            </div>
            <p className="text-center text-xs text-slate-400">推荐下载 JPG 格式直接用于电商上架；PNG 格式保留透明背景可二次编辑</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-slate-800">常见问题</h2></div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:no-underline py-4">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
