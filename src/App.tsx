import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { I18nProvider, useI18n } from '@/i18n'
import { Home } from '@/pages/Home'
import { RemoveBg } from '@/pages/RemoveBg'
import { WhiteBg } from '@/pages/WhiteBg'
import { Enhance } from '@/pages/Enhance'
import { Watermark } from '@/pages/Watermark'
import { Retouch } from '@/pages/Retouch'
import { Scissors, Sparkles, ShieldCheck, Image, Zap, Pen } from 'lucide-react'
import './App.css'

function Footer() {
  const year = new Date().getFullYear()
  const { t } = useI18n()
  return (
    <footer className="border-t bg-white mt-12">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 font-extrabold text-lg text-slate-900 mb-2">
              <img
                src="/logo.png"
                alt="改图工具箱"
                className="h-8 w-auto object-contain"
              />
              改图工具箱
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t('footer.desc')}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('footer.privacy')}
            </div>
          </div>

          {/* Tools */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3">{t('footer.tools')}</h3>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <Link to="/remove-background" className="hover:text-violet-600 transition-colors flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5" /> {t('tool.rb.title')}
                </Link>
              </li>
              <li>
                <Link to="/white-background" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" /> {t('tool.wb.title')}
                </Link>
              </li>
              <li>
                <Link to="/enhance" className="hover:text-amber-600 transition-colors flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> {t('tool.en.title')}
                </Link>
              </li>
              <li>
                <Link to="/remove-watermark" className="hover:text-emerald-600 transition-colors flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {t('tool.wm.title')}
                </Link>
              </li>
              <li>
                <Link to="/retouch" className="hover:text-purple-600 transition-colors flex items-center gap-1.5">
                  <Pen className="w-3.5 h-3.5" /> {t('tool.rt.title')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3">{t('footer.about')}</h3>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <a href="#" className="hover:text-violet-600 transition-colors">{t('footer.privacyPolicy')}</a>
              </li>
              <li>
                <a href="#" className="hover:text-violet-600 transition-colors">{t('footer.terms')}</a>
              </li>
              <li>
                <a href="#" className="hover:text-violet-600 transition-colors">{t('footer.contact')}</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>{t('footer.rights', { year })}</p>
          <div className="flex items-center gap-4">
            <span>{t('footer.icp')}</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer" className="hover:text-slate-600 transition-colors hidden sm:inline">
              {t('footer.beianQuery')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/remove-background" element={<RemoveBg />} />
              <Route path="/white-background" element={<WhiteBg />} />
              <Route path="/enhance" element={<Enhance />} />
              <Route path="/remove-watermark" element={<Watermark />} />
              <Route path="/retouch" element={<Retouch />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </I18nProvider>
    </BrowserRouter>
  )
}

export default App
