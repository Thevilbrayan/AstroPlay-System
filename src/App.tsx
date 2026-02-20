import { useState } from 'react';
import { useAuthStore } from './store/auth.store';
import { Login } from './components/Login';
import Dashboard from './components/Dashboard';
import CheckInScreen from './components/CheckInScreen';
import InventoryPOS from './components/InventoryPOS';
import MainLayout from './components/layout/MainLayout';

function App() {
  const { isValid } = useAuthStore();
  const [currentView, setCurrentView] = useState<'dashboard' | 'checkin' | 'inventory'>('dashboard');

  // Si no está logueado, mostramos el Login.
  if (!isValid) {
    return <Login />;
  }

  // Simple router for now
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentView} />;
      case 'checkin':
        return <CheckInScreen />;
      case 'inventory':
        return <InventoryPOS />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <MainLayout currentView={currentView} onNavigate={(view) => setCurrentView(view as any)}>
      {renderView()}
    </MainLayout>
  );
}

export default App;