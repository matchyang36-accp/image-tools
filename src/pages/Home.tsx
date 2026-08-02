import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Image, Scissors, Sparkles, Upload, Zap, ArrowRight,
  Check, Star, ShieldCheck, TrendingUp,
} from 'lucide-react'

const tools = [
  {
    id: 'remove-bg',
    title: 'AI 智能抠图',
    description: '一键移除图片背景，发丝级精准识别，3秒出结果',
    icon: Scissors,
    href: '/remove-background',
    badge: '热门',
    badgeVariant: 'hot' as const,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'white-bg',
    title: 'AI 白底图',
    description: '自动生成电商白底图，适配淘宝/京东/拼多多',
    icon: Image,
    href: '#',
    badge: '即将上线',
    badgeVariant: 'soon' as const,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'enhance',
    title: '图片变清晰',
    description: 'AI 提升分辨率，修复模糊、噪点和压缩痕迹，还原高清画质',
    icon: Sparkles,
    href: '#',
    badge: '即将上线',
    badgeVariant: 'soon' as const,
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'watermark',
    title: '去水印',
    description: '智能识别并消除水印、文字、日期等不需要的元素',
    icon: Zap,
    href: '#',
    badge: '即将上线',
    badgeVariant: 'soon' as const,
    color: 'from-emerald-500 to-green-600',
  },
]

const features = [
  { icon: Upload, title: '拖拽上传', desc: '支持拖拽、粘贴、URL 多种方式', bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-200' },
  { icon: Zap, title: 'AI 秒速处理', desc: '智能识别，3秒完成处理', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  { icon: Image, title: '高清输出', desc: '保留原始画质，支持批量处理', bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
]

const trustStats = [
  { icon: Image, value: '10,000+', label: '图片已处理', color: 'text-violet-600' },
  { icon: Star, value: '4.9', label: '用户评分', color: 'text-amber-500' },
  { icon: TrendingUp, value: '99.8%', label: '识别成功率', color: 'text-emerald-600' },
  { icon: ShieldCheck, value: '隐私安全', label: '本地处理不泄露', color: 'text-blue-600' },
]

export function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative pt-3 sm:pt-6 pb-2 sm:pb-4 px-4 text-center">
        <div className="mx-auto max-w-4xl">
          {/* Top badge */}
          <Badge variant="secondary" className="mb-3 px-3 py-1 text-xs gap-1">
            <Sparkles className="w-3 h-3" />
            AI 驱动 · 免费在线 · 无需下载
          </Badge>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            一键<span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">抠图</span>，
            <br className="sm:hidden" />
            让图片处理变简单
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-slate-500 max-w-xl mx-auto">
            上传图片，AI 自动处理。抠图、变清晰、去水印——无需下载，打开浏览器就能用。
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/remove-background">
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-violet-200"
              >
                <Upload className="w-4 h-4" />
                开始使用
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-300 hover:border-violet-300 hover:text-violet-700 gap-2"
              onClick={() => alert('批量处理功能即将上线，支持一次处理最多 100 张图片！')}
            >
              <Zap className="w-4 h-4" />
              批量处理
            </Button>
          </div>

          {/* Before/After Demo */}
          <div className="mt-4 sm:mt-6 mx-auto max-w-lg">
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
              {/* Demo header bar */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs text-slate-400 ml-2">AI 抠图 · 效果预览</span>
              </div>
              {/* Demo comparison area */}
              <div className="relative h-24 sm:h-36 overflow-hidden bg-grid">
                {/* Left half - "Before" */}
                <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden bg-slate-100">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Stylized image placeholder */}
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-white to-slate-200 border border-slate-300 flex items-center justify-center shadow-inner">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-sky-200 to-indigo-200 flex items-center justify-center relative">
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm" />
                        <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-amber-300" />
                      </div>
                    </div>
                    {/* Background noise dots */}
                    <div className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                        backgroundSize: '12px 12px',
                      }}
                    />
                  </div>
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white text-xs px-2 py-0.5 rounded-md font-medium">
                    处理前
                  </div>
                </div>
                {/* Right half - "After" */}
                <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden bg-checkerboard">
                  <div className="absolute inset-0 flex items-center justify-center" style={{ clipPath: 'inset(0 0 0 0)' }}>
                    <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-sky-200 to-indigo-200 flex items-center justify-center relative">
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm" />
                        <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-amber-300" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-violet-600/80 backdrop-blur text-white text-xs px-2 py-0.5 rounded-md font-medium">
                    处理后
                  </div>
                </div>
                {/* Divider */}
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white shadow-md" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-200">
                  <ArrowRight className="w-3.5 h-3.5 text-violet-500" />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">↑ 拖拽图片即刻体验，无需注册</p>

            {/* Scroll-down hint */}
            <div className="mt-2 flex flex-col items-center gap-1 text-slate-400">
              <span className="text-xs">向下滚动查看全部工具</span>
              <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* Bottom gradient to hint more content below */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Feature highlights - different colored icons */}
      <section className="pt-3 sm:pt-4 pb-4 sm:pb-6 px-4">
        <div className="mx-auto max-w-3xl grid grid-cols-3 gap-2 sm:gap-4 text-center">
          {features.map((f, i) => (
            <div key={i} className="p-3 sm:p-4 rounded-xl hover:bg-slate-50 transition-colors">
              <div className={`mx-auto w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${f.bg} flex items-center justify-center mb-2 sm:mb-3 ring-1 ${f.ring}`}>
                <f.icon className={`w-5 h-5 ${f.text}`} />
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-slate-900">{f.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools grid - enhanced hover */}
      <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">全部工具</h2>
            <p className="text-sm text-slate-500 mt-1">选择你需要的图片处理工具</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {tools.map((tool) => (
              <Link key={tool.id} to={tool.href}>
                <Card className="group relative hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer h-full border-slate-200 overflow-hidden">
                  {/* Gradient glow on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />
                  <CardHeader className="relative">
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                        <tool.icon className="w-5 h-5 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium ${
                          tool.badgeVariant === 'hot'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {tool.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-3 group-hover:text-violet-700 transition-colors">{tool.title}</CardTitle>
                    <CardDescription className="text-sm">{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="relative pt-0">
                    <div className="flex items-center gap-1 text-sm text-violet-600 group-hover:gap-2 transition-all font-medium">
                      立即使用 <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-violet-50/50 border border-slate-200 p-6 sm:p-8">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">值得信赖的 AI 图片处理</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {trustStats.map((s, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-white/80 backdrop-blur border border-slate-100">
                  <div className={`mx-auto w-9 h-9 rounded-lg ${s.color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')} flex items-center justify-center mb-2`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Trust badges */}
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Check className="w-3 h-3 text-emerald-500" />
              图片仅本地处理，不上传服务器
              <span className="text-slate-300">·</span>
              <Check className="w-3 h-3 text-emerald-500" />
              支持 JPG / PNG / WebP 格式
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">三步完成图片处理</h2>
            <p className="text-sm text-slate-500 mt-1">不需要任何专业知识，每个人都能轻松上手</p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {[
              { step: '01', title: '上传图片', desc: '拖拽、粘贴或点击上传，支持 JPG/PNG/WebP' },
              { step: '02', title: 'AI 自动处理', desc: '智能识别并完成处理，无需手动操作' },
              { step: '03', title: '下载使用', desc: '预览效果满意后直接下载高清图片' },
            ].map((s, i) => (
              <div key={i} className="text-center group">
                <div className="relative inline-block mb-3">
                  <div className="text-2xl sm:text-3xl font-extrabold text-violet-100 group-hover:text-violet-200 transition-colors">
                    {s.step}
                  </div>
                  {i < 2 && (
                    <div className="hidden sm:block absolute top-1/2 -right-6 w-6 h-0.5 bg-violet-200" />
                  )}
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-slate-900 mb-1">{s.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
