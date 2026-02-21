import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { TitleBar } from './TitleBar';
import { useUIStore } from '../../store/ui.store';
import { useThemeStore } from '../../store/theme.store';
import { cn } from '../../lib/utils';

interface MainLayoutProps {
    children: React.ReactNode;
    currentView?: string;
    onNavigate?: (view: string) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentView, onNavigate }) => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const { isFullscreen } = useUIStore();
    const { theme } = useThemeStore();

    return (
        <div className={cn(
            "fixed inset-0 bg-slate-950 font-sans text-slate-200 flex transition-colors duration-300",
            theme === 'light' ? "light-theme" : ""
        )}>

            {/* Custom Title Bar */}
            <TitleBar />

            {/* Sidebar */}
            <Sidebar
                currentView={currentView}
                onNavigate={onNavigate}
                onCollapsedChange={setIsSidebarCollapsed}
            />

            {/* Main Content Area */}
            <div
                className="flex-1 flex flex-col transition-all duration-300 ease-in-out min-h-0"
                style={{ marginLeft: isSidebarCollapsed ? 64 : 256 }}
            >
                {/* Spacer for title bar (36px) + header (80px) — does NOT eat into children's h-full */}
                <div className={`shrink-0 ${isFullscreen ? 'h-20' : 'h-[116px]'}`} />

                {/* Header — fixed positioned on top */}
                <Header isCollapsed={isSidebarCollapsed} />

                {/* Content Scrollable Area — full remaining height, no padding tricks */}
                <main className="flex-1 overflow-y-auto p-6 relative min-h-0">
                    {/* Decorative Background Element */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
