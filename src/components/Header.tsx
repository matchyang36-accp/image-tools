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
import { Globe } from 'lucide-react'
import {
  Image, MessageSquare, Sparkles, ChevronDown,
  Scissors, Zap, Star, Clock, Gift, Pen, Check as CheckIcon,
} from 'lucide-react'
import { useI18n } from '@/i18n'

const allTools = [
  {
    icon: Scissors,
    labelKey: 'tool.rb.title',
    href: '/remove-background',
    badgeKey: 'tool.rb.badgeHot',
    badgeClass: 'bg-red-50 text-red-600 border-red-200',
  },
  {
    icon: Image,
    labelKey: 'tool.wb.title',
    href: '/white-background',
    badgeKey: 'tool.rb.badgeNew',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    icon: Sparkles,
    labelKey: 'tool.en.title',
    href: '/enhance',
    badgeKey: 'tool.rb.badgeNew',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    icon: Zap,
    labelKey: 'tool.wm.title',
    href: '/remove-watermark',
    badgeKey: 'tool.rb.badgeNew',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    icon: Pen,
    labelKey: 'tool.rt.title',
    href: '/retouch',
    badgeKey: 'tool.rb.badgeNew',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
]

// 每日免费次数（后续可对接后端）
const DAILY_FREE = 5
const usedToday = 2 // TODO: 从 localStorage 或后端读取

export function Header() {
  const location = useLocation()
  const { t, lang, setLang, languages } = useI18n()
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
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-extrabold text-xl text-slate-900 tracking-tight">
          <img
            src="/logo.png"
            alt="改图工具箱"
            className="h-10 w-auto object-contain"
          />
          改图工具箱
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5">
          <Link to="/">
            <Button
              variant={location.pathname === '/' ? 'secondary' : 'ghost'}
              size="sm"
            >
              {t('common.home')}
            </Button>
          </Link>

          {/* 全部工具 - 下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={location.pathname !== '/' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1"
              >
                <Image className="w-4 h-4" />
                {t('common.allTools')}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal">{t('common.allTools')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allTools.map((tool) => (
                <DropdownMenuItem key={tool.labelKey} asChild>
                  <Link
                    to={tool.href}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <tool.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="flex-1">{t(tool.labelKey)}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 border ${tool.badgeClass}`}>
                      {t(tool.badgeKey)}
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
            onClick={() => alert(t('common.myWorksAlert'))}
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.myWorks')}</span>
          </Button>

          {/* 每日免费次数 */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 border border-violet-100 text-xs">
            <Gift className="w-3 h-3 text-violet-500" />
            <span className="text-violet-700 font-medium">{t('common.todayRemaining')} <strong>{remaining}</strong> {t('common.times')}</span>
          </div>

          {/* 星标评分 */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex items-center gap-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
            onClick={() => alert(t('common.feedback.thanks'))}
          >
            <Star className="w-4 h-4 fill-amber-400" />
            <span className="text-xs">4.9</span>
          </Button>

          {/* 语言切换器 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-slate-600 hover:text-violet-600"
                aria-label="Language"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{languages.find((l) => l.code === lang)?.flag}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs text-slate-400 font-normal">Language / 语言</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {languages.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex items-center gap-2 cursor-pointer ${l.code === lang ? 'bg-violet-50 text-violet-700' : ''}`}
                >
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {l.code === lang && <CheckIcon className="w-3.5 h-3.5 text-violet-600" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 意见反馈 */}
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-violet-600 gap-1">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.feedback')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t('feedback.title')}</DialogTitle>
                <DialogDescription>
                  {t('feedback.desc')}
                </DialogDescription>
              </DialogHeader>
              {submitted ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{t('feedback.thanks')}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('feedback.thanksDesc')}</p>
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder={t('feedback.placeholder')}
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
                      {sending ? t('feedback.submitting') : t('feedback.submit')}
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
