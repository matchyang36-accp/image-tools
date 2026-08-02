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
  Scissors, ClipboardPaste, Sparkles, Check,
  Loader2, ArrowLeftRight, AlertCircle, Lock, HelpCircle,
  Palette, Wand2, Pen, Eraser, Undo2, Check as CheckIcon,
} from 'lucide-react'
import { removeBackground } from '@imgly/background-removal'

const FAQ_ITEMS = [
  {
    q: '支持哪些图片格式？',
    a: '支持 JPG、JPEG、PNG、WebP 格式。处理后统一输出为透明背景的 PNG 格式。',
  },
  {
    q: '图片大小有限制吗？',
    a: '建议上传 10MB 以内的图片，分辨率不超过 4096×4096 像素，超大图片处理时间较长且可能受浏览器内存限制。',
  },
  {
    q: '首次处理为什么比较慢？',
    a: 'AI 模型（约 40MB）在首次使用时会自动下载到你的浏览器缓存中，之后再使用就会很快。建议在 Wi-Fi 环境下使用。',
  },
  {
    q: '图片会上传到服务器吗？',
    a: '完全不会。所有处理都在你的浏览器本地完成，图片数据不会离开你的设备，不存在隐私泄露风险。',
  },
  {
    q: '抠图效果不好怎么办？',
    a: '建议使用背景与主体色差较大的图片，光线均匀的照片效果更好。后续将上线「手动修复笔」功能，支持手动涂抹精修边缘。',
  },
  {
    q: '支持批量处理吗？',
    a: '批量处理功能正在开发中，即将上线，支持一次上传多张图片同时处理。',
  },
]

type ProcessState = 'idle' | 'processing' | 'done' | 'error'

interface ProcessResult {
  original: string
  result: string | null
  fileName: string
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 8
const ZOOM_STEP = 0.25

export function RemoveBg() {
  const [state, setState] = useState<ProcessState>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [compareMode, setCompareMode] = useState<'result' | 'original' | 'split'>('result')
  const [sliderPos, setSliderPos] = useState(50) // 对比滑块位置（百分比）

  // ───── 缩放 & 平移状态 ─────
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // RAF 节流（滚轮）
  const wheelRafRef = useRef(0)
  const pendingZoomRef = useRef(0)

  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // ───── 后续处理状态 ─────
  const [editMode, setEditMode] = useState<'preview' | 'retouch'>('preview')
  const [retouchBrushSize, setRetouchBrushSize] = useState(20)
  const [retouchBrushMode, setRetouchBrushMode] = useState<'erase' | 'restore'>('erase')
  const retouchCanvasRef = useRef<HTMLCanvasElement>(null)
  const retouchDataRef = useRef<ImageData | null>(null)
  const retouchHistoryRef = useRef<Uint8Array[]>([])
  const isRetouchingRef = useRef(false)

  // ───── 辅助函数 ─────
  const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v))

  // 适应画布
  const fitToCanvas = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // 改变 compareMode 时适应画布
  useEffect(() => { fitToCanvas() }, [compareMode, fitToCanvas])

  // ───── 按钮步进缩放 ─────
  const zoomBy = useCallback((delta: number) => {
    setZoom((prev) => clampZoom(prev + delta))
  }, [])

  // ───── 滚轮缩放（RAF 节流） ─────
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

  // ───── 拖拽平移（仅放大后允许） ─────
  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    if (zoom <= 1) return
    isPanningRef.current = true
    panStartRef.current = { x: clientX, y: clientY, panX: pan.x, panY: pan.y }
  }, [pan, zoom])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      setPan({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      })
    }
    const onUp = () => { isPanningRef.current = false }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ───── 移动端 双指捏合 + 单指平移 ─────
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    let pinchStart = { dist: 0, zoom: 1 }
    let singleTouch = { x: 0, y: 0, panX: 0, panY: 0, active: false }

    const getDist = (touches: TouchList) => {
      if (touches.length < 2) return 0
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (compareMode === 'split') return // 对比模式留给滑块处理
      if (e.touches.length === 2) {
        // 双指捏合
        pinchStart = { dist: getDist(e.touches), zoom: zoom }
        singleTouch.active = false
      } else if (e.touches.length === 1 && zoom > 1) {
        // 单指平移
        singleTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y, active: true }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // 双指捏合缩放
        const newDist = getDist(e.touches)
        if (pinchStart.dist > 0) {
          const scale = newDist / pinchStart.dist
          setZoom(clampZoom(pinchStart.zoom * scale))
        }
        singleTouch.active = false
        return
      }
      if (singleTouch.active && e.touches[0]) {
        setPan({
          x: singleTouch.panX + (e.touches[0].clientX - singleTouch.x),
          y: singleTouch.panY + (e.touches[0].clientY - singleTouch.y),
        })
      }
    }

    const onTouchEnd = () => {
      pinchStart = { dist: 0, zoom: 1 }
      singleTouch.active = false
      isPanningRef.current = false
    }

    viewport.addEventListener('touchstart', onTouchStart, { passive: true })
    viewport.addEventListener('touchmove', onTouchMove, { passive: true })
    viewport.addEventListener('touchend', onTouchEnd)
    viewport.addEventListener('touchcancel', onTouchEnd)
    return () => {
      viewport.removeEventListener('touchstart', onTouchStart)
      viewport.removeEventListener('touchmove', onTouchMove)
      viewport.removeEventListener('touchend', onTouchEnd)
      viewport.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [zoom, pan, compareMode])

  // 注册全局粘贴事件
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
  }, [state]) // eslint-disable-line

  useEffect(() => {
    document.addEventListener('paste', handlePasteCallback)
    return () => document.removeEventListener('paste', handlePasteCallback)
  }, [handlePasteCallback])

  const processImage = useCallback(async (file: File) => {
    const originalUrl = URL.createObjectURL(file)
    setResult({ original: originalUrl, result: null, fileName: file.name })
    setErrorMsg('')
    setState('processing')
    setProgress(10)

    // 进度模拟（首次使用会下载 AI 模型，需要更长时间）
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 8, 90))
    }, 800)

    try {
      // 使用 @imgly/background-removal 在浏览器本地执行 AI 抠图
      // 首次运行会自动下载模型（约 40MB），之后缓存在浏览器中
      const blob = await removeBackground(file)

      clearInterval(progressInterval)
      setProgress(100)
      const resultUrl = URL.createObjectURL(blob)
      setResult((prev) => prev ? { ...prev, result: resultUrl } : null)
      setState('done')
    } catch (err: unknown) {
      clearInterval(progressInterval)
      const msg = err instanceof Error ? err.message : '处理失败，请重试'
      setErrorMsg(msg)
      setState('error')
    }
  }, [])

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
    setResult(null)
    setState('idle')
    setProgress(0)
    setErrorMsg('')
    setCompareMode('result')
    setSliderPos(50)
    setEditMode('preview')
    fitToCanvas()
  }

  const handleDownload = async () => {
    if (!result?.result) return
    const a = document.createElement('a')
    a.href = result.result
    const baseName = result.fileName.replace(/\.[^.]+$/, '')
    a.download = `${baseName}-nobg.png`
    a.click()
  }

  // ───── 后续处理：通用加载图片 ─────
  const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })

  // 更新结果图（释放旧 blob）
  const updateResult = useCallback((newUrl: string) => {
    if (result?.result) URL.revokeObjectURL(result.result)
    setResult((prev) => prev ? { ...prev, result: newUrl } : null)
  }, [result])

  // ───── 后续处理：白底图 ─────
  const applyWhiteBg = useCallback(async () => {
    if (!result?.result) return
    const img = await loadImage(result.result)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
    updateResult(URL.createObjectURL(blob))
  }, [result, updateResult])

  // ───── 后续处理：变清晰（Unsharp Mask） ─────
  const applyEnhance = useCallback(async () => {
    if (!result?.result) return
    const img = await loadImage(result.result)
    const w = img.naturalWidth, h = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const src = ctx.getImageData(0, 0, w, h)
    const dst = ctx.createImageData(w, h)

    // 高斯模糊（半径 1）
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1]
    const gauss = new Uint8ClampedArray(src.data.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, weight = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ny = y + ky, nx = x + kx
            if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue
            const idx = (ny * w + nx) * 4
            const wgt = kernel[(ky + 1) * 3 + (kx + 1)]
            r += src.data[idx] * wgt; g += src.data[idx + 1] * wgt; b += src.data[idx + 2] * wgt; a += src.data[idx + 3] * wgt
            weight += wgt
          }
        }
        const i = (y * w + x) * 4
        gauss[i] = r / weight; gauss[i + 1] = g / weight; gauss[i + 2] = b / weight; gauss[i + 3] = a / weight
      }
    }

    // Unsharp mask: result = original + (original - blur) * amount
    const amount = 0.6
    for (let i = 0; i < src.data.length; i += 4) {
      dst.data[i] = Math.min(255, Math.max(0, src.data[i] + (src.data[i] - gauss[i]) * amount))
      dst.data[i + 1] = Math.min(255, Math.max(0, src.data[i + 1] + (src.data[i + 1] - gauss[i + 1]) * amount))
      dst.data[i + 2] = Math.min(255, Math.max(0, src.data[i + 2] + (src.data[i + 2] - gauss[i + 2]) * amount))
      dst.data[i + 3] = src.data[i + 3]
    }
    ctx.putImageData(dst, 0, 0)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
    updateResult(URL.createObjectURL(blob))
  }, [result, updateResult])

  // ───── 后续处理：手动精修 ─────
  const startRetouch = useCallback(() => {
    setEditMode('retouch')
  }, [])

  // canvas 挂载后初始化精修数据
  useEffect(() => {
    if (editMode !== 'retouch' || !result?.result || !retouchCanvasRef.current) return
    const canvas = retouchCanvasRef.current
    const img = new Image()
    img.onload = () => {
      canvas.width = Math.min(img.naturalWidth, 2048)
      const scale = canvas.width / img.naturalWidth
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      retouchDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      retouchHistoryRef.current = []
    }
    img.src = result.result
  }, [editMode, result])

  const doPaint = useCallback((clientX: number, clientY: number) => {
    const canvas = retouchCanvasRef.current
    if (!canvas || !retouchDataRef.current) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((clientX - rect.left) * scaleX)
    const y = Math.floor((clientY - rect.top) * scaleY)
    const { data, width, height } = retouchDataRef.current
    const r = retouchBrushSize

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const pi = (ny * width + nx) * 4
        data[pi + 3] = retouchBrushMode === 'erase' ? 0 : 255
      }
    }
    canvas.getContext('2d')!.putImageData(retouchDataRef.current, 0, 0)
  }, [retouchBrushSize, retouchBrushMode])

  const startRetouchPaint = useCallback((clientX: number, clientY: number) => {
    if (!retouchDataRef.current) return
    const { data, width, height } = retouchDataRef.current
    const prevAlpha = new Uint8Array(width * height)
    for (let i = 0; i < prevAlpha.length; i++) prevAlpha[i] = data[i * 4 + 3]
    retouchHistoryRef.current.push(prevAlpha)
    doPaint(clientX, clientY)
  }, [doPaint])

  const undoRetouch = useCallback(() => {
    if (retouchHistoryRef.current.length === 0 || !retouchDataRef.current || !retouchCanvasRef.current) return
    const prevAlpha = retouchHistoryRef.current.pop()!
    const { data, width } = retouchDataRef.current
    for (let i = 0; i < prevAlpha.length; i++) data[i * 4 + 3] = prevAlpha[i]
    retouchCanvasRef.current.getContext('2d')!.putImageData(retouchDataRef.current, 0, 0)
  }, [])

  const finishRetouch = useCallback(async () => {
    const canvas = retouchCanvasRef.current
    if (!canvas) return
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
    updateResult(URL.createObjectURL(blob))
    setEditMode('preview')
  }, [updateResult])

  const cancelRetouch = useCallback(() => {
    setEditMode('preview')
  }, [])

  // 对比滑块拖拽逻辑
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(pos)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) handleSliderMove(e.clientX)
    }
    const handleMouseUp = () => { isDraggingRef.current = false }
    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches[0]) handleSliderMove(e.touches[0].clientX)
    }
    const handleTouchEnd = () => { isDraggingRef.current = false }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleSliderMove])

  const startDrag = () => { isDraggingRef.current = true }

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Page header */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3">
            <Scissors className="w-3 h-3 mr-1" />
            AI 智能抠图
          </Badge>
          <h1 className="text-3xl font-bold text-slate-900">免费在线 AI 抠图</h1>
          <p className="mt-2 text-slate-500">
            上传图片，AI 自动移除背景，3秒出结果
          </p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" />
            100% 免费 · 本地 AI 处理 · 无需注册
          </div>
        </div>

        {/* Upload zone */}
        {state === 'idle' && (
          <Card
            className="border-2 border-dashed border-slate-200 hover:border-violet-300 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-1">上传图片</h3>
              <p className="text-sm text-slate-400 mb-4">
                拖拽文件到此处，或点击上传 / Ctrl+V 粘贴
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <ImagePlus className="w-3 h-3" /> JPG / PNG / WebP
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardPaste className="w-3 h-3" /> 支持粘贴
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ''
                }}
              />
              {/* 隐私声明 */}
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <Lock className="w-3 h-3 text-green-500 flex-shrink-0" />
                图片仅在本地处理，不上传服务器，24小时内自动清除，保障您的隐私
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing state */}
        {state === 'processing' && result && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                  <Sparkles className="w-5 h-5 text-violet-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="font-medium text-slate-700">
                  AI 正在处理中...
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {progress < 30
                    ? '正在加载 AI 模型（首次较慢，之后会缓存）...'
                    : '正在智能识别并移除背景，请稍候'}
                </p>
                <div className="w-64 mt-4">
                  <Progress value={progress} className="h-1.5" />
                </div>
                <p className="text-xs text-slate-400 mt-2">{Math.round(progress)}%</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {state === 'error' && (
          <Card className="border-red-100">
            <CardContent className="py-10">
              <div className="flex flex-col items-center text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                <h3 className="font-medium text-slate-700 mb-1">处理失败</h3>
                <p className="text-sm text-slate-400 mb-4">{errorMsg}</p>
                <Button variant="outline" onClick={handleReset}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重试
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result state */}
        {state === 'done' && result && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={editMode === 'retouch' ? 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-50' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-50'}>
                      {editMode === 'retouch' ? <Pen className="w-3 h-3 mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                      {editMode === 'retouch' ? '手动精修' : '处理完成'}
                    </Badge>
                    <span className="text-xs text-slate-400 truncate max-w-[200px]">{result.fileName}</span>
                  </div>
                  {editMode === 'retouch' ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 画笔模式 */}
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button onClick={() => setRetouchBrushMode('erase')} className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${retouchBrushMode === 'erase' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                          <Eraser className="w-3.5 h-3.5" />擦除
                        </button>
                        <button onClick={() => setRetouchBrushMode('restore')} className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${retouchBrushMode === 'restore' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                          <Undo2 className="w-3.5 h-3.5" />恢复
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">大小</span>
                        <input type="range" min={2} max={100} value={retouchBrushSize} onChange={(e) => setRetouchBrushSize(Number(e.target.value))} className="w-20 accent-violet-500" />
                        <span className="text-xs text-slate-400 w-8">{retouchBrushSize}px</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={undoRetouch} disabled={retouchHistoryRef.current.length === 0} className="text-xs gap-1 px-2">
                        <Undo2 className="w-3.5 h-3.5" />撤销
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelRetouch} className="text-xs px-2">取消</Button>
                      <Button size="sm" onClick={finishRetouch} className="text-xs gap-1 bg-violet-600 hover:bg-violet-700 px-2">
                        <CheckIcon className="w-3.5 h-3.5" />完成
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* 缩放工具栏 */}
                      <div className="flex items-stretch bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          onClick={() => zoomBy(-ZOOM_STEP)}
                          disabled={zoom <= ZOOM_MIN}
                          className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200"
                          title="缩小"
                        >
                          −
                        </button>
                        <span className="w-12 h-8 flex items-center justify-center text-xs text-slate-600 bg-slate-50 border-r border-slate-200 select-none">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={() => zoomBy(ZOOM_STEP)}
                          disabled={zoom >= ZOOM_MAX}
                          className="w-8 h-8 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 border-r border-slate-200"
                          title="放大"
                        >
                          +
                        </button>
                        <button
                          onClick={fitToCanvas}
                          className="w-8 h-8 flex items-center justify-center text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                          title="适应画布"
                        >
                          ⊡
                        </button>
                      </div>
                      {/* 查看模式切换 */}
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                        {([
                          { key: 'result', label: '结果' },
                          { key: 'original', label: '原图' },
                          { key: 'split', label: '对比' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setCompareMode(opt.key)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              compareMode === opt.key
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {editMode === 'retouch' ? (
                  <div
                    className="relative rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center select-none touch-none border border-slate-200"
                    style={{
                      backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                        linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                        linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    }}
                  >
                    <canvas
                      ref={retouchCanvasRef}
                      className="max-w-full max-h-[60vh] object-contain"
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => { isRetouchingRef.current = true; startRetouchPaint(e.clientX, e.clientY) }}
                      onMouseMove={(e) => { if (isRetouchingRef.current) doPaint(e.clientX, e.clientY) }}
                      onMouseUp={() => { isRetouchingRef.current = false }}
                      onMouseLeave={() => { isRetouchingRef.current = false }}
                      onTouchStart={(e) => { e.preventDefault(); isRetouchingRef.current = true; if (e.touches[0]) startRetouchPaint(e.touches[0].clientX, e.touches[0].clientY) }}
                      onTouchMove={(e) => { e.preventDefault(); if (isRetouchingRef.current && e.touches[0]) doPaint(e.touches[0].clientX, e.touches[0].clientY) }}
                      onTouchEnd={() => { isRetouchingRef.current = false }}
                    />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/55 text-white/90 text-xs px-2.5 py-1 rounded-full pointer-events-none z-20 backdrop-blur-sm">
                      擦除=透明 / 恢复=还原 / 完成后点击右上角「完成」
                    </div>
                  </div>
                ) : (
                  <>{/* Image preview — GPU 加速缩放 */}
                  <div
                    ref={viewportRef}
                    className="relative rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center select-none touch-none"
                    style={{
                      backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
                        linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
                        linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                      cursor: zoom > 1 ? (isPanningRef.current ? 'grabbing' : 'grab') : 'zoom-in',
                    }}
                    onWheel={handleWheel}
                    onMouseDown={(e) => {
                      if (compareMode !== 'split') {
                        e.preventDefault()
                        handlePanStart(e.clientX, e.clientY)
                      }
                    }}
                    onDoubleClick={fitToCanvas}
                    title={zoom > 1 ? '双击适应画布 · 拖拽平移 · 滚轮缩放' : '滚轮缩放 · 按钮缩放 · 双击还原'}
                  >
                  {compareMode === 'split' ? (
                    <div
                      ref={sliderRef}
                      className="relative w-full h-[400px] select-none cursor-col-resize"
                      onMouseDown={(e) => { e.preventDefault(); startDrag(); handleSliderMove(e.clientX) }}
                      onTouchStart={(e) => { if (e.touches[0]) { startDrag(); handleSliderMove(e.touches[0].clientX) } }}
                    >
                      {/* 对比模式 — 缩放平移层 */}
                      <div
                        className="absolute inset-0"
                        style={{
                          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                          transformOrigin: 'center center',
                          transition: 'transform 0.2s ease-out',
                          willChange: 'transform',
                        }}
                      >
                        <img
                          src={result.result || result.original}
                          alt="Result"
                          className="absolute inset-0 w-full h-full object-contain"
                          draggable={false}
                        />
                        <div className="absolute top-2 right-2 bg-violet-600/80 text-white text-xs px-2 py-0.5 rounded">抠图结果</div>

                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                        >
                          <img
                            src={result.original}
                            alt="Original"
                            className="w-full h-full object-contain"
                            draggable={false}
                          />
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">原图</div>
                        </div>
                      </div>

                      {/* 滑块线 — 不参与缩放 */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-10"
                        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
                      />
                      {/* 滑块手柄 — 不参与缩放 */}
                      <div
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center pointer-events-none z-10"
                        style={{ left: `${sliderPos}%` }}
                      >
                        <ArrowLeftRight className="w-4 h-4 text-slate-600" />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.2s ease-out',
                        willChange: 'transform',
                      }}
                    >
                      <img
                        src={compareMode === 'original' ? result.original : (result.result || result.original)}
                        alt={compareMode === 'original' ? 'Original' : 'Result'}
                        className="max-h-[400px] object-contain pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  )}

                  {/* 缩放提示 */}
                  {zoom > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/55 text-white/90 text-xs px-2.5 py-1 rounded-full pointer-events-none z-20 backdrop-blur-sm">
                      双击适应画布 · 拖拽平移
                    </div>
                  )}
                </div>
                </>)}
              </CardContent>
            </Card>

            {/* 后续处理工具栏 */}
            {editMode === 'preview' && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={applyWhiteBg} className="gap-1.5">
                  <Palette className="w-3.5 h-3.5" />白底图
                </Button>
                <Button variant="outline" size="sm" onClick={applyEnhance} className="gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />变清晰
                </Button>
                <Button variant="outline" size="sm" onClick={startRetouch} className="gap-1.5">
                  <Pen className="w-3.5 h-3.5" />手动精修
                </Button>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {editMode === 'preview' && (
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  下载透明 PNG
                </Button>
              )}
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                重新上传
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400">
              {editMode === 'retouch' ? '手动精修模式下，擦除区域将变为透明，恢复区域还原为原始像素' : '下载为透明 PNG，可直接用于电商上架、海报设计等场景'}
            </p>
          </div>
        )}
        {/* FAQ */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-slate-800">常见问题</h2>
          </div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm"
              >
                <AccordionTrigger className="text-sm font-medium text-slate-800 hover:text-violet-700 hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 pb-4 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
