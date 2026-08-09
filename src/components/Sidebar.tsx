import { ViewState } from '../types';
import { Home, Library, PlusSquare, PlaySquare, Settings, Tv, Calendar, LogOut } from 'lucide-react';
import { closeWindow } from '../utils/tauri';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
}

export default function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const navItems = [
    { id: 'home', icon: Home, label: 'الرئيسية' },
    { id: 'channels', icon: Tv, label: 'القنوات والراديو' },
    { id: 'schedule', icon: Calendar, label: 'الجدول الأسبوعي' },
    { id: 'library', icon: Library, label: 'المكتبة' },
    { id: 'sessions', icon: PlaySquare, label: 'الجلسات الذكية' },
    { id: 'create_watchlist', icon: PlusSquare, label: 'إضافة محتوى' },
    { id: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <aside 
      className="relative h-full w-20 md:w-24 lg:hover:w-64 transition-[width] duration-300 ease-in-out flex flex-col items-center lg:hover:items-start py-4 md:py-8 glass-panel z-50 group overflow-y-auto no-scrollbar touch-pan-y shrink-0 border-l border-white/10"
      style={{ touchAction: 'pan-y' }}
    >
      {/* App Header / Logo */}
      <div className="flex mb-4 md:mb-8 w-full px-2 md:px-3 shrink-0 justify-center lg:group-hover:justify-start">
        <div className="flex items-center gap-3 w-full py-1.5 md:py-2 justify-center lg:group-hover:justify-start">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-gradient-to-tr from-amber-400/30 via-white/15 to-white/5 border border-white/30 shadow-lg shrink-0 flex items-center justify-center lg:group-hover:scale-105 transition-transform mx-auto lg:group-hover:mx-0">
            <Tv className="w-5 h-5 md:w-6 md:h-6 text-amber-300 shrink-0" />
          </div>
          <span className="text-lg md:text-xl font-extrabold tracking-tight opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden text-white hidden lg:group-hover:block">
            شاشتي TV
          </span>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col justify-start gap-2 md:gap-3 px-2 md:px-3 items-center min-h-0 overflow-y-auto no-scrollbar touch-pan-y">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as ViewState)}
              className={`flex flex-row items-center gap-3 p-2 md:p-2.5 rounded-2xl transition-colors duration-150 relative w-full justify-center lg:group-hover:justify-start cursor-pointer active:scale-95 ${
                isActive ? 'text-white bg-white/20 border border-white/30 shadow-lg font-bold' : 'text-white/60 hover:bg-white/10 hover:text-white font-medium'
              }`}
              title={item.label}
            >
              <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 flex items-center justify-center relative z-10 mx-auto lg:group-hover:mx-0">
                <Icon className="w-5 h-5 md:w-6 md:h-6 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span className="text-sm md:text-base font-bold opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap relative z-10 hidden lg:group-hover:inline-block">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Exit Button at Bottom of Right Sidebar */}
      <div className="w-full px-2 md:px-3 pt-3 mt-auto border-t border-white/10 shrink-0">
        <button
          onClick={() => closeWindow()}
          className="flex flex-row items-center gap-3 p-2 md:p-2.5 rounded-2xl transition-all duration-200 relative w-full justify-center lg:group-hover:justify-start cursor-pointer active:scale-95 text-red-400 bg-red-500/10 hover:bg-red-600 hover:text-white border border-red-500/30 shadow-lg group/exit"
          title="خروج من التطبيق"
        >
          <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 flex items-center justify-center relative z-10 mx-auto lg:group-hover:mx-0">
            <LogOut className="w-5 h-5 md:w-6 md:h-6 shrink-0 group-hover/exit:scale-110 transition-transform" />
          </div>
          <span className="text-sm md:text-base font-bold opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap relative z-10 hidden lg:group-hover:inline-block">
            خروج
          </span>
        </button>
      </div>
    </aside>
  );
}
