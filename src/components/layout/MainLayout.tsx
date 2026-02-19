import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface MainLayoutProps {
    children: React.ReactNode;
    currentView?: string;
    onNavigate?: (view: string) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentView, onNavigate }) => {
    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200 overflow-hidden flex">

            {/* Sidebar */}
            <Sidebar currentView={currentView} onNavigate={onNavigate} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col ml-64 transition-all duration-300">

                {/* Header */}
                <Header />

                {/* Content Scrollable Area */}
                <main className="flex-1 overflow-y-auto mt-20 p-6 relative">
                    {/* Decorative Background Element */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
