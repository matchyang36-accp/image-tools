import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Upload, Download, RefreshCw, ImagePlus, ClipboardPaste,
  Check, Loader2, AlertCircle, Lock, HelpCircle, Pen, Undo2, Eraser,
} from 'lucide-react'

const FAQ_ITEMS = [
  { q: '手动精修能做什么？', a: '可以在图片上用画笔擦除不需要的部分（如残留背景边缘），或用恢复笔还原误擦的区域。适合对 AI 抠图结果进行精细化修整。' },
  { q: '如何使用画笔？', a: '模式选"橡皮擦"：在图片上涂抹可擦除像素（变透明）；选"恢复笔"：可恢复之前擦除的像素。可用鼠标/触控操作。' },
  { q: '图片会上传到服务器吗？', a: '完全不会。所有处理在浏览器本地完成，图片数据不会离开你的设备。' },
  { q: '支持哪些图片格式？', a: '支持所有主流格式（JPG/PNG/WebP），输出为透明背景 PNG。' },
  { q: '误操作了怎么办？', a: '点"撤销"可回退上一步操作。支持多次撤销。' },
  { q: '画笔大小可以调吗？', a: '可以，顶部有画笔大小滑块，从 2px 到 100px 可调。处理细节用较小画笔，大面积用较大画笔。' },
]

type ProcessState = 'idle' | 'editing' | 'done' | 'error'

export function Retouch() {
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

  const [zoom, setZoom] = useState(1)
  const clampZoom = (v: number) => Math.min(8, Math.max(0.5, v))
  const fitToCanvas = useCallback(() => setZoom(1), [])
  const zoomBy = useCallback((d: number) => setZoom((p) => clampZoom(p + d)), [])

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
    const img = new Image()
    img.onload = () => {
      const maxDim = 2048
      let w = img.naturalWidth, h = img.naturalHeight
      if (Math.max(w, h) > maxDim) { const r = maxDim / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r) }
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        originalDataRef.current = ctx.getImageData(0, 0, w, h)
        alphaHistoryRef.current = []
        setState('editing')
      }
    }
    img.src = url
  }, [])

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
    const { data, width } = originalDataRef.current
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
          <Badge variant="secondary" className="mb-3"><Pen className="w-3 h-3 mr-1" />手动精修</Badge>
          <h1 className="text-3xl font-bold text-slate-900">画笔模式，手动精修图片细节</h1>
          <p className="mt-2 text-slate-500">用橡皮擦去除多余边缘，用恢复笔还原误擦部分。适合抠图后精修</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />100% 免费 · 本地处理 · 无需注册</div>
        </div>

        {/* Upload */}
        {state === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 hover:border-violet-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-violet-500" /></div>
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

        {/* Editing mode */}
        {state === 'editing' && originalSrc && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-50 text-violet-700 border border-violet-200"><Pen className="w-3 h-3 mr-1" />精修模式</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Brush mode toggle */}
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setBrushMode('eraser')} className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${brushMode === 'eraser' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      <Eraser className="w-3.5 h-3.5" />橡皮擦
                    </button>
                    <button onClick={() => setBrushMode('restore')} className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${brushMode === 'restore' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                      <Undo2 className="w-3.5 h-3.5" />恢复笔
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">大小</span>
                    <input type="range" min={2} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-16 accent-violet-500" />
                    <span className="text-xs text-slate-400 w-8">{brushSize}px</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleUndo} disabled={alphaHistoryRef.current.length === 0} className="text-xs gap-1">
                    <Undo2 className="w-3.5 h-3.5" />撤销
                  </Button>
                </div>
              </div>

              <div className="relative rounded-lg overflow-hidden border border-slate-200 select-none"
                style={{ minHeight: '300px', backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseDown={(e) => { isDrawingRef.current = true; paintAt(e.clientX, e.clientY) }}
                onMouseMove={(e) => { if (isDrawingRef.current) paintAt(e.clientX, e.clientY) }}
                onMouseUp={() => { isDrawingRef.current = false }}
                onMouseLeave={() => { isDrawingRef.current = false }}
                onTouchStart={(e) => { e.preventDefault(); isDrawingRef.current = true; if (e.touches[0]) paintAt(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchMove={(e) => { e.preventDefault(); if (isDrawingRef.current && e.touches[0]) paintAt(e.touches[0].clientX, e.touches[0].clientY) }}
                onTouchEnd={() => { isDrawingRef.current = false }}
              >
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', cursor: brushMode === 'eraser' ? 'crosshair' : 'cell' }} />
              </div>
              <p className="mt-2 text-xs text-slate-400 text-center">
                {brushMode === 'eraser' ? '橡皮擦模式：涂抹区域将变为透明（棋盘格背景）' : '恢复笔模式：涂抹区域将恢复为原始像素'}
              </p>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDone} className="gap-2 bg-violet-600 hover:bg-violet-700"><Check className="w-4 h-4" />完成精修</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />重新上传</Button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <Card className="border-red-100"><CardContent className="py-10"><div className="flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" /><h3 className="font-medium text-slate-700 mb-1">处理失败</h3>
            <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />重试</Button>
          </div></CardContent></Card>
        )}

        {state === 'done' && resultSrc && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-50 text-green-700 border border-green-200"><Check className="w-3 h-3 mr-1" />精修完成</Badge>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                </div>
              </div>
              <div className="relative rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]"
                style={{ backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}>
                <img src={resultSrc} alt="Result" className="max-h-[400px] object-contain" />
              </div>
            </CardContent></Card>

            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDownload} className="gap-2 bg-violet-600 hover:bg-violet-700"><Download className="w-4 h-4" />下载透明 PNG</Button>
              <Button variant="outline" onClick={handleBackToEdit} className="gap-2"><Pen className="w-4 h-4" />继续精修</Button>
              <Button variant="outline" onClick={handleReset} className="gap-2"><RefreshCw className="w-4 h-4" />重新上传</Button>
            </div>
            <p className="text-center text-xs text-slate-400">下载为透明 PNG，可直接用于电商上架、海报设计等场景</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4"><HelpCircle className="w-4 h-4 text-violet-500" /><h2 className="font-semibold text-slate-800">常见问题</h2></div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-violet-700 hover:no-underline py-4">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
