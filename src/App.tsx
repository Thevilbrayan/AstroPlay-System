import { useState, useEffect } from 'react';
import { pb } from './lib/pocketbase';
import { useSettingsStore } from './store/settings.store';
import { useAuthStore } from './store/auth.store';
import { useWorkstationStore } from './store/workstation.store';
import { useThemeStore } from './store/theme.store';
import { Login } from './components/Login';
import { WorkstationSetup } from './components/WorkstationSetup';
import { SettingsView } from './components/admin/SettingsView';
import { StationManager } from './components/admin/StationManager';
import { LiveMonitor } from './components/dashboard/LiveMonitor';
import TimeDashboard from './components/dashboard/TimeDashboard';
import SecurityCheckIn from './components/SecurityCheckIn';
import InventoryPOS from './components/inventory/InventoryPOS';
import { HardwareConfig } from './components/admin/HardwareConfig';
import MainLayout from './components/layout/MainLayout';
import ReportsView from './components/dashboard/ReportsView';
import CashCloseView from './components/dashboard/CashCloseView';
import { AdminAuditView } from './components/admin/AdminAuditView';

function App() {
  const { user, isValid } = useAuthStore();
  const { workstationId, clearWorkstation } = useWorkstationStore();
  const [currentView, setCurrentView] = useState<'dashboard' | 'checkin' | 'pos' | 'inventory' | 'settings' | 'stations' | 'hardware' | 'reports' | 'cashclose' | 'audits'>('dashboard');
  const { theme } = useThemeStore();
  const { fetchSettings } = useSettingsStore();

  // Initialize Global Settings
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Workstation Handshake
  useEffect(() => {
    const verifyWorkstation = async () => {
      if (!workstationId) return;
      try {
        const record = await pb.collection('workstations').getOne(workstationId);
        if (!record.is_active) {
          console.warn('Workstation is deactivated. Discarding local identity.');
          clearWorkstation();
        }
      } catch (err: any) {
        if (!err.isAbort) {
          console.error('Handshake failed or workstation deleted:', err);
          clearWorkstation();
        }
      }
    };

    verifyWorkstation();
  }, [workstationId, clearWorkstation]);

  // Si no está logueado, mostramos el Login.
  if (!isValid) {
    return <Login />;
  }

  // Si no hay workstation configurado, bloqueamos la app en la pantalla de setup
  if (!workstationId) {
    return <WorkstationSetup />;
  }

  // Simple router for now
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        // Optional: Render LiveMonitor for Admins, TimeDashboard for Ops
        return user?.role === 'admin'
          ? <LiveMonitor onNavigate={(v) => setCurrentView(v as any)} />
          : <TimeDashboard onNavigate={(v) => setCurrentView(v as any)} />;
      case 'reports':
        return <ReportsView />;
      case 'cashclose':
        return <CashCloseView />;
      case 'audits':
        return <AdminAuditView />;
      case 'checkin':
        return <SecurityCheckIn onNavigate={setCurrentView as any} />;
      case 'pos':
        return <InventoryPOS view="pos" onNavigate={(v) => setCurrentView(v as any)} />;
      case 'inventory':
        return <InventoryPOS view="inventory" onNavigate={(v) => setCurrentView(v as any)} />;
      case 'settings':
        return user?.role === 'admin' ? <SettingsView /> : <TimeDashboard />;
      case 'stations':
        return user?.role === 'admin' ? <StationManager /> : <TimeDashboard />;
      case 'hardware':
        return user?.role === 'admin' ? <HardwareConfig /> : <TimeDashboard />;
      default:
        return user?.role === 'admin' ? <LiveMonitor /> : <TimeDashboard />;
    }
  };

  return (
    <MainLayout currentView={currentView} onNavigate={(view) => setCurrentView(view as any)}>
      {renderView()}
    </MainLayout>
  );
}

export default App;