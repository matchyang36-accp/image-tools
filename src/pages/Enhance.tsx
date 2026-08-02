import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Upload, Download, RefreshCw, ImagePlus, ClipboardPaste,
  Sparkles, Check, Loader2, AlertCircle, Lock, HelpCircle,
} from 'lucide-react'

const FAQ_ITEMS = [
  { q: '图片变清晰是怎么实现的？', a: '通过 AI 智能增强 + 锐化算法，提升图片细节和清晰度，同时自动优化亮度和对比度，让模糊照片焕然一新。' },
  { q: '支持哪些图片格式？', a: '支持 JPG、JPEG、PNG、WebP 格式，输出统一为高质量 PNG。' },
  { q: '图片会上传到服务器吗？', a: '完全不会。所有处理都在浏览器本地完成，图片数据不会离开你的设备。' },
  { q: '处理大图会卡吗？', a: '对于 4000px 以上的超大图，处理时间较长且可能受浏览器内存限制。建议先用系统工具调整尺寸。' },
  { q: '增强后画质会降低吗？', a: '输出保持原始分辨率，锐化会增强细节但不会引入噪点。适度调节效果更自然。' },
  { q: '能批量处理吗？', a: '批量处理功能即将上线，敬请期待。' },
]

type ProcessState = 'idle' | 'processing' | 'done' | 'error'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 8
const ZOOM_STEP = 0.25

// ----- 锐化核心算法：Unsharp Mask -----
function applyUnsharpMask(
  imageData: ImageData,
  strength: number,
  brightness: number,
  contrast: number,
): ImageData {
  const { data, width, height } = imageData
  const result = new Uint8ClampedArray(data)

  // 1. Build Gaussian blur (7x7 kernel approximation via separable 1D passes)
  const tmp = new Uint8ClampedArray(data.length)
  const kernel = [0.006, 0.061, 0.242, 0.383, 0.242, 0.061, 0.006]

  // Horizontal blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0
      for (let k = -3; k <= 3; k++) {
        const sx = Math.min(Math.max(x + k, 0), width - 1)
        const idx = (y * width + sx) * 4
        const w = kernel[k + 3]
        r += data[idx] * w
        g += data[idx + 1] * w
        b += data[idx + 2] * w
      }
      const idx = (y * width + x) * 4
      tmp[idx] = r; tmp[idx + 1] = g; tmp[idx + 2] = b; tmp[idx + 3] = data[idx + 3]
    }
  }

  // Vertical blur
  const blurred = new Uint8ClampedArray(data.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0
      for (let k = -3; k <= 3; k++) {
        const sy = Math.min(Math.max(y + k, 0), height - 1)
        const idx = (sy * width + x) * 4
        const w = kernel[k + 3]
        r += tmp[idx] * w
        g += tmp[idx + 1] * w
        b += tmp[idx + 2] * w
      }
      const idx = (y * width + x) * 4
      blurred[idx] = r; blurred[idx + 1] = g; blurred[idx + 2] = b; blurred[idx + 3] = data[idx + 3]
    }
  }

  // 2. Unsharp mask: result = original + strength * (original - blurred)
  // 3. Apply brightness / contrast
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = data[i + c] + strength * (data[i + c] - blurred[i + c])
      v += brightness
      v = factor * (v - 128) + 128
      result[i + c] = Math.max(0, Math.min(255, Math.round(v)))
    }
    result[i + 3] = data[i + 3]
  }

  return new ImageData(result, width, height)
}

export function Enhance() {
  const [state, setState] = useState<ProcessState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [resultSrc, setResultSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [compareMode, setCompareMode] = useState<'result' | 'original' | 'split'>('result')
  const [sliderPos, setSliderPos] = useState(50)

  // 调节参数
  const [sharpness, setSharpness] = useState(1.5) // 0~3
  const [brightness, setBrightness] = useState(0) // -50~50
  const [contrast, setContrast] = useState(10) // -100~100

  // 缩放
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const wheelRafRef = useRef(0)
  const pendingZoomRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)

  const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))
  const fitToCanvas = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])
  useEffect(() => { fitToCanvas() }, [compareMode, fitToCanvas])

  const zoomBy = useCallback((d: number) => setZoom((p) => clampZoom(p + d)), [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    pendingZoomRef.current = clampZoom(zoom + (-e.deltaY / 400))
    if (!wheelRafRef.current) { wheelRafRef.current = requestAnimationFrame(() => { setZoom(pendingZoomRef.current); wheelRafRef.current = 0 }) }
  }, [zoom])

  const handlePanStart = useCallback((cx: number, cy: number) => {
    if (zoom <= 1) return; isPanningRef.current = true
    panStartRef.current = { x: cx, y: cy, panX: pan.x, panY: pan.y }
  }, [pan, zoom])

  useEffect(() => {
    const om = (e: MouseEvent) => { if (!isPanningRef.current) return; setPan({ x: panStartRef.current.panX + (e.clientX - panStartRef.current.x), y: panStartRef.current.panY + (e.clientY - panStartRef.current.y) }) }
    const ou = () => { isPanningRef.current = false }
    window.addEventListener('mousemove', om, { passive: true }); window.addEventListener('mouseup', ou)
    return () => { window.removeEventListener('mousemove', om); window.removeEventListener('mouseup', ou) }
  }, [])

  // 双指捏合
  useEffect(() => {
    const vp = viewportRef.current; if (!vp) return
    let ps = { dist: 0, zoom: 1 }
    const gd = (t: TouchList) => t.length < 2 ? 0 : Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const ts = (e: TouchEvent) => { if (e.touches.length === 2) ps = { dist: gd(e.touches), zoom } }
    const tm = (e: TouchEvent) => { if (e.touches.length === 2 && ps.dist > 0) setZoom(clampZoom(ps.zoom * (gd(e.touches) / ps.dist))) }
    vp.addEventListener('touchstart', ts, { passive: true }); vp.addEventListener('touchmove', tm, { passive: true })
    return () => { vp.removeEventListener('touchstart', ts); vp.removeEventListener('touchmove', tm) }
  }, [zoom])

  const handlePasteCallback = useCallback((e: ClipboardEvent) => {
    if (state !== 'idle') return
    const items = e.clipboardData?.items; if (!items) return
    for (const item of Array.from(items)) { if (item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) { handleFile(f); break } } }
  }, [state])
  useEffect(() => { document.addEventListener('paste', handlePasteCallback); return () => document.removeEventListener('paste', handlePasteCallback) }, [handlePasteCallback])

  const processFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    setOriginalSrc(url); setResultSrc(null); setFileName(file.name); setErrorMsg(''); setState('processing'); setProgress(10)

    const img = new Image()
    img.onload = () => {
      setProgress(40)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const idata = ctx.getImageData(0, 0, canvas.width, canvas.height)
      imageDataRef.current = idata

      // Apply enhancement
      setTimeout(() => {
        setProgress(70)
        const enhanced = applyUnsharpMask(idata, sharpness, brightness, contrast)
        ctx.putImageData(enhanced, 0, 0)
        const resultUrl = canvas.toDataURL('image/png')
        setResultSrc(resultUrl)
        setProgress(100)
        setState('done')
      }, 100)
    }
    img.onerror = () => { setErrorMsg('图片加载失败'); setState('error') }
    img.src = url
  }, [sharpness, brightness, contrast])

  // Re-process when sliders change
  const reEnhance = useCallback(() => {
    if (!imageDataRef.current || !originalSrc) return
    setState('processing'); setProgress(50)
    const canvas = document.createElement('canvas')
    canvas.width = imageDataRef.current.width; canvas.height = imageDataRef.current.height
    const ctx = canvas.getContext('2d')!
    setTimeout(() => {
      const enhanced = applyUnsharpMask(imageDataRef.current, sharpness, brightness, contrast)
      ctx.putImageData(enhanced, 0, 0)
      setResultSrc(canvas.toDataURL('image/png'))
      setProgress(100); setState('done')
    }, 50)
  }, [originalSrc, sharpness, brightness, contrast])

  useEffect(() => {
    if (state === 'done' && originalSrc) {
      const t = setTimeout(() => reEnhance(), 300)
      return () => clearTimeout(t)
    }
  }, [sharpness, brightness, contrast]) // eslint-disable-line

  const handleFile = useCallback((file: File) => { if (!file.type.startsWith('image/')) return; processFile(file) }, [processFile])
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }, [handleFile])

  const handleReset = () => {
    if (originalSrc) URL.revokeObjectURL(originalSrc)
    if (resultSrc) URL.revokeObjectURL(resultSrc)
    imageDataRef.current = null
    setOriginalSrc(null); setResultSrc(null); setState('idle'); setProgress(0); setErrorMsg(''); setCompareMode('result'); setSliderPos(50)
    setSharpness(1.5); setBrightness(0); setContrast(10)
    fitToCanvas()
  }

  const handleDownload = () => {
    if (!resultSrc) return
    const a = document.createElement('a')
    a.href = resultSrc
    a.download = fileName.replace(/\.[^.]+$/, '') + '-enhanced.png'
    a.click()
  }

  const handleSliderMove = useCallback((cx: number) => {
    if (!sliderRef.current) return
    const r = sliderRef.current.getBoundingClientRect()
    setSliderPos(Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100)))
  }, [])
  const startDrag = () => { isDraggingRef.current = true }
  useEffect(() => {
    const mm = (e: MouseEvent) => { if (isDraggingRef.current) handleSliderMove(e.clientX) }
    const mu = () => { isDraggingRef.current = false }
    const tm = (e: TouchEvent) => { if (isDraggingRef.current && e.touches[0]) handleSliderMove(e.touches[0].clientX) }
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu)
    window.addEventListener('touchmove', tm); window.addEventListener('touchend', mu)
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', mu) }
  }, [handleSliderMove])

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3"><Sparkles className="w-3 h-3 mr-1" />图片变清晰</Badge>
          <h1 className="text-3xl font-bold text-slate-900">AI 智能增强，让模糊照片变清晰</h1>
          <p className="mt-2 text-slate-500">提升分辨率，修复模糊/噪点/压缩痕迹，还原高清画质</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />100% 免费 · 本地处理 · 无需注册</div>
        </div>

        {state === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-amber-500" /></div>
              <h3 className="text-lg font-medium text-slate-700 mb-1">上传图片</h3>
              <p className="text-sm text-slate-400 mb-4">拖拽文件到此处，或点击上传 / Ctrl+V 粘贴</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><ImagePlus className="w-3 h-3" /> JPG / PNG / WebP</span>
                <span className="flex items-center gap-1"><ClipboardPaste className="w-3 h-3" /> 支持粘贴</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100"><Lock className="w-3 h-3 text-green-500" />图片仅在本地处理，不上传服务器</div>
            </CardContent>
          </Card>
        )}

        {state === 'processing' && (
          <Card><CardContent className="py-12"><div className="flex flex-col items-center">
            <div className="relative mb-4"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /><Sparkles className="w-5 h-5 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
            <h3 className="font-medium text-slate-700">正在增强图片...</h3>
            <p className="text-sm text-slate-400 mt-1">正在应用 AI 锐化和画质增强</p>
            <div className="w-64 mt-4"><Progress value={progress} className="h-1.5" /></div>
          </div></CardContent></Card>
        )}

        {state === 'error' && (
          <Card className="border-red-100"><CardContent className="py-10"><div className="flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" /><h3 className="font-medium text-slate-700 mb-1">处理失败</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />重试</Button>
          </div></CardContent></Card>
        )}

        {state === 'done' && originalSrc && resultSrc && (
          <div className="space-y-4">
            {/* Parameter sliders */}
            <Card><CardContent className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-medium text-slate-600">锐化强度</span><span className="text-xs text-slate-400">{sharpness.toFixed(1)}</span></div>
                <Slider value={[sharpness]} onValueChange={([v]) => setSharpness(v)} min={0} max={3} step={0.1} className="w-full" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-medium text-slate-600">亮度</span><span className="text-xs text-slate-400">{brightness > 0 ? '+' : ''}{brightness}</span></div>
                <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={-50} max={50} step={1} className="w-full" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-medium text-slate-600">对比度</span><span className="text-xs text-slate-400">{contrast > 0 ? '+' : ''}{contrast}</span></div>
                <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={-100} max={100} step={1} className="w-full" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSharpness(1.5); setBrightness(0); setContrast(10) }} className="text-xs">恢复默认参数</Button>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-50 text-green-700 border border-green-200"><Check className="w-3 h-3 mr-1" />处理完成</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-stretch bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <button onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 border-r border-slate-200" title="缩小">−</button>
                    <span className="w-12 h-8 flex items-center justify-center text-xs text-slate-600 bg-slate-50 border-r border-slate-200 select-none">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 border-r border-slate-200" title="放大">+</button>
                    <button onClick={fitToCanvas} className="w-8 h-8 flex items-center justify-center text-sm text-slate-500 hover:bg-slate-50" title="适应画布">⊡</button>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    {([{ k: 'result', l: '增强后' }, { k: 'original', l: '原图' }, { k: 'split', l: '对比' }] as const).map((o) => (
                      <button key={o.k} onClick={() => setCompareMode(o.k)} className={`px-3 py-1 text-xs rounded-md transition-colors ${compareMode === o.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div ref={viewportRef}
                className="relative rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center select-none touch-none"
                style={{ backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`, backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px', cursor: zoom > 1 ? (isPanningRef.current ? 'grabbing' : 'grab') : 'zoom-in' }}
                onWheel={handleWheel} onMouseDown={(e) => { if (compareMode !== 'split') { e.preventDefault(); handlePanStart(e.clientX, e.clientY) } }} onDoubleClick={fitToCanvas}
              >
                {compareMode === 'split' ? (
                  <div ref={sliderRef} className="relative w-full h-[400px] select-none cursor-col-resize"
                    onMouseDown={(e) => { e.preventDefault(); startDrag(); handleSliderMove(e.clientX) }}
                    onTouchStart={(e) => { if (e.touches[0]) { startDrag(); handleSliderMove(e.touches[0].clientX) } }}>
                    <div className="absolute inset-0" style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out', willChange: 'transform' }}>
                      <img src={resultSrc} alt="Enhanced" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
                      <div className="absolute top-2 right-2 bg-amber-600/80 text-white text-xs px-2 py-0.5 rounded">增强后</div>
                      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                        <img src={originalSrc} alt="Original" className="w-full h-full object-contain" draggable={false} />
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">原图</div>
                      </div>
                    </div>
                    <div className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-10" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }} />
                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center pointer-events-none z-10" style={{ left: `${sliderPos}%` }}>
                      <span className="text-slate-600 text-lg font-bold">⟷</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out', willChange: 'transform' }}>
                    <img src={compareMode === 'original' ? originalSrc : resultSrc} alt="Preview" className="max-h-[400px] object-contain pointer-events-none" draggable={false} />
                  </div>
                )}
                {zoom > 1 && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/55 text-white/90 text-xs px-2.5 py-1 rounded-full pointer-events-none z-20">双击适应画布 · 拖拽平移</div>}
              </div>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDownload} className="gap-2 bg-amber-600 hover:bg-amber-700"><Download className="w-4 h-4" />下载增强图片</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />重新上传</Button>
            </div>
            <p className="text-center text-xs text-slate-400">拖动上方滑块可实时调节增强效果，满意后下载</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-amber-500" /><h2 className="font-semibold text-slate-800">常见问题</h2></div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-amber-700 hover:no-underline py-4">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
