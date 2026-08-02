import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Image, MessageSquare, Sparkles, ChevronDown,
  Scissors, Zap, Star, Clock, Gift,
} from 'lucide-react'

const allTools = [
  {
    icon: Scissors,
    label: 'AI 智能抠图',
    href: '/remove-background',
    badge: '可用',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    icon: Image,
    label: 'AI 白底图',
    href: '#',
    badge: '即将上线',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
  },
  {
    icon: Sparkles,
    label: '图片变清晰',
    href: '#',
    badge: '即将上线',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
  },
  {
    icon: Zap,
    label: '去水印',
    href: '#',
    badge: '即将上线',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
  },
]

// 每日免费次数（后续可对接后端）
const DAILY_FREE = 5
const usedToday = 2 // TODO: 从 localStorage 或后端读取

export function Header() {
  const location = useLocation()
  const [feedback, setFeedback] = useState('')
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const remaining = DAILY_FREE - usedToday

  const handleSubmit = async () => {
    if (!feedback.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: feedback, page: location.pathname }),
      })
      if (!res.ok) throw new Error('提交失败')
      setFeedback('')
      setSubmitted(true)
    } catch {
      const existing = JSON.parse(localStorage.getItem('feedback_list') || '[]')
      existing.push({
        content: feedback,
        time: new Date().toISOString(),
        page: location.pathname,
      })
      localStorage.setItem('feedback_list', JSON.stringify(existing))
      setFeedback('')
      setSubmitted(true)
    } finally {
      setSending(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setTimeout(() => setSubmitted(false), 200)
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        {/* Logo - 放大 */}
        <Link to="/" className="flex items-center gap-2.5 font-extrabold text-xl text-slate-900 tracking-tight">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          改图工具箱
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5">
          <Link to="/">
            <Button
              variant={location.pathname === '/' ? 'secondary' : 'ghost'}
              size="sm"
            >
              首页
            </Button>
          </Link>

          {/* 全部工具 - 下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={location.pathname.startsWith('/remove-background') ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1"
              >
                <Image className="w-4 h-4" />
                全部工具
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal">图片处理工具</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allTools.map((t) => (
                <DropdownMenuItem key={t.label} asChild>
                  <Link
                    to={t.href}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <t.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="flex-1">{t.label}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 border ${t.badgeClass}`}>
                      {t.badge}
                    </Badge>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 我的作品 - 占位入口 */}
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 gap-1"
            onClick={() => alert('我的作品功能即将上线！处理过的图片将会自动保存在这里。')}
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">我的作品</span>
          </Button>

          {/* 每日免费次数 */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 border border-violet-100 text-xs">
            <Gift className="w-3 h-3 text-violet-500" />
            <span className="text-violet-700 font-medium">今日剩余 <strong>{remaining}</strong> 次</span>
          </div>

          {/* 星标评分 */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex items-center gap-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
            onClick={() => alert('感谢你的支持！')}
          >
            <Star className="w-4 h-4 fill-amber-400" />
            <span className="text-xs">4.9</span>
          </Button>

          {/* 意见反馈 */}
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-violet-600 gap-1">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">意见反馈</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>意见反馈</DialogTitle>
                <DialogDescription>
                  欢迎提出你的建议、问题或想法，帮助我们做得更好。
                </DialogDescription>
              </DialogHeader>
              {submitted ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-900">感谢你的反馈！</p>
                  <p className="text-xs text-slate-500 mt-1">我们会认真对待每一条建议。</p>
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder="请描述你的意见或建议..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                  <DialogFooter>
                    <Button
                      onClick={handleSubmit}
                      disabled={!feedback.trim() || sending}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {sending ? '提交中...' : '提交反馈'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </header>
  )
}
