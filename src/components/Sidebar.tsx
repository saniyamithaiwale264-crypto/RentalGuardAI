import {
  BookOpen,
  FileSearch,
  GitCompare,
  LayoutDashboard,
  MessageSquareText,
  Scale,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.tsx';
import type { UiKey } from '../utils/i18n.ts';
import { LanguageSelector } from './LanguageSelector.tsx';

export type NavTab = 'dashboard' | 'upload' | 'results' | 'chat' | 'rulebook' | 'compare';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hasActiveResult: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  labelKey: UiKey;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard },
  { id: 'upload', labelKey: 'navUpload', icon: Upload },
  { id: 'results', labelKey: 'navResults', icon: FileSearch },
  { id: 'chat', labelKey: 'navChat', icon: MessageSquareText },
  { id: 'rulebook', labelKey: 'navRulebook', icon: BookOpen },
  { id: 'compare', labelKey: 'navCompare', icon: GitCompare },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  hasActiveResult,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { t } = useLanguage();

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200/90 px-4 py-5 overflow-y-auto">
      <div>
        <div className="flex items-center justify-between px-2 pb-6 border-b border-slate-200/80">
          <button
            type="button"
            onClick={() => {
              onSelectTab('dashboard');
              onCloseMobile();
            }}
            className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                RentalGuard AI
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {t('tagline')}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-5 space-y-1" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const disabled = item.id === 'results' && !hasActiveResult;

            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold'
                    : disabled
                    ? 'text-slate-300 cursor-not-allowed border border-transparent'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-indigo-600' : disabled ? 'text-slate-300' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-3">
          <LanguageSelector />
        </div>

        <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Scale className="h-3.5 w-3.5 text-indigo-600 shrink-0" aria-hidden="true" />
            <span>{t('informationalNotice')}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {t('informationalNoticeBody')}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">{navContent}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[82vw] h-full z-10 shadow-xl">{navContent}</div>
        </div>
      )}
    </>
  );
}
