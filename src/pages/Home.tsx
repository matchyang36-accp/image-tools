import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Image, Scissors, Sparkles, Upload, Zap, ArrowRight,
  Check, Star, ShieldCheck, TrendingUp, Pen,
} from 'lucide-react'
import { useI18n } from '@/i18n'

const tools = [
  {
    id: 'remove-bg',
    titleKey: 'tool.rb.title',
    descKey: 'tool.rb.desc',
    icon: Scissors,
    href: '/remove-background',
    badgeKey: 'tool.rb.badgeHot',
    badgeVariant: 'hot' as const,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'white-bg',
    titleKey: 'tool.wb.title',
    descKey: 'tool.wb.desc',
    icon: Image,
    href: '/white-background',
    badgeKey: 'tool.rb.badgeNew',
    badgeVariant: 'new' as const,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'enhance',
    titleKey: 'tool.en.title',
    descKey: 'tool.en.desc',
    icon: Sparkles,
    href: '/enhance',
    badgeKey: 'tool.rb.badgeNew',
    badgeVariant: 'new' as const,
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'watermark',
    titleKey: 'tool.wm.title',
    descKey: 'tool.wm.desc',
    icon: Zap,
    href: '/remove-watermark',
    badgeKey: 'tool.rb.badgeNew',
    badgeVariant: 'new' as const,
    color: 'from-emerald-500 to-green-600',
  },
  {
    id: 'retouch',
    titleKey: 'tool.rt.title',
    descKey: 'tool.rt.desc',
    icon: Pen,
    href: '/retouch',
    badgeKey: 'tool.rb.badgeNew',
    badgeVariant: 'new' as const,
    color: 'from-rose-500 to-pink-600',
  },
]

const features = [
  { icon: Upload, titleKey: 'feat.upload.title', descKey: 'feat.upload.desc', bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-200' },
  { icon: Zap, titleKey: 'feat.fast.title', descKey: 'feat.fast.desc', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  { icon: Image, titleKey: 'feat.hd.title', descKey: 'feat.hd.desc', bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
]

const trustStats = [
  { icon: Image, value: '10,000+', labelKey: 'stat.images', color: 'text-violet-600' },
  { icon: Star, value: '4.9', labelKey: 'stat.rating', color: 'text-amber-500' },
  { icon: TrendingUp, value: '99.8%', labelKey: 'stat.success', color: 'text-emerald-600' },
  { icon: ShieldCheck, value: '', labelKey: 'stat.privacy', color: 'text-blue-600' },
]

export function Home() {
  const { t } = useI18n()
  return (
    <div>
      {/* Hero */}
      <section className="relative pt-3 sm:pt-6 pb-2 sm:pb-4 px-4 text-center">
        <div className="mx-auto max-w-4xl">
          {/* Top badge */}
          <Badge variant="secondary" className="mb-3 px-3 py-1 text-xs gap-1">
            <Sparkles className="w-3 h-3" />
            {t('home.topBadge')}
          </Badge>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            {t('home.heroLine1')}<span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">{t('home.heroHighlight')}</span>，
            <br className="sm:hidden" />
            {t('home.heroLine2')}
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-slate-500 max-w-xl mx-auto">
            {t('home.heroDesc')}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/remove-background">
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-violet-200"
              >
                <Upload className="w-4 h-4" />
                {t('home.start')}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-300 hover:border-violet-300 hover:text-violet-700 gap-2"
              onClick={() => alert(t('home.batchAlert'))}
            >
              <Zap className="w-4 h-4" />
              {t('home.batch')}
            </Button>
          </div>

          {/* Product Demo */}
          <div className="mt-6 sm:mt-8 mx-auto max-w-3xl px-2">
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
              <img
                src="/visual-4.png"
                alt="Edit Photo 产品界面预览"
                className="w-full h-auto object-contain"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">{t('home.demoHint')}</p>

            {/* Scroll-down hint */}
            <div className="mt-2 flex flex-col items-center gap-1 text-slate-400">
              <span className="text-xs">{t('home.scrollHint')}</span>
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
              <h3 className="font-semibold text-sm sm:text-base text-slate-900">{t(f.titleKey)}</h3>
              <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools grid - enhanced hover */}
      <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t('home.toolsTitle')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('home.toolsSub')}</p>
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
                            : tool.badgeVariant === 'new'
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {t(tool.badgeKey)}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-3 group-hover:text-violet-700 transition-colors">{t(tool.titleKey)}</CardTitle>
                    <CardDescription className="text-sm">{t(tool.descKey)}</CardDescription>
                  </CardHeader>
                  <CardContent className="relative pt-0">
                    <div className="flex items-center gap-1 text-sm text-violet-600 group-hover:gap-2 transition-all font-medium">
                      {t('home.useNow')} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{t('home.trustTitle')}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {trustStats.map((s, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-white/80 backdrop-blur border border-slate-100">
                  <div className={`mx-auto w-9 h-9 rounded-lg ${s.color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')} flex items-center justify-center mb-2`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value || t(s.labelKey)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t(s.labelKey)}</div>
                </div>
              ))}
            </div>
            {/* Trust badges */}
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Check className="w-3 h-3 text-emerald-500" />
              {t('home.trustLocal')}
              <span className="text-slate-300">·</span>
              <Check className="w-3 h-3 text-emerald-500" />
              {t('home.trustFmt')}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t('home.howTitle')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('home.howSub')}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {[
              { step: '01', titleKey: 'home.step1Title', descKey: 'home.step1Desc' },
              { step: '02', titleKey: 'home.step2Title', descKey: 'home.step2Desc' },
              { step: '03', titleKey: 'home.step3Title', descKey: 'home.step3Desc' },
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
                <h3 className="font-semibold text-sm sm:text-base text-slate-900 mb-1">{t(s.titleKey)}</h3>
                <p className="text-xs sm:text-sm text-slate-400">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
