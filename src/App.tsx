import { useAuthStore } from './store/auth.store';
import { Login } from './components/Login';

function App() {
  const { isValid, logout, user } = useAuthStore();

  // Si no está logueado, mostramos el Login.
  if (!isValid) {
    return <Login />;
  }

  // Si ya entró, mostramos el Dashboard.
  return (
    <div className="min-h-screen bg-slate-900 p-10 text-white">
      <header className="flex items-center justify-between border-b border-slate-700 pb-5">
        <div>
          <h1 className="text-3xl font-bold">Panel de Control</h1>
          <p className="text-slate-400">Bienvenido de nuevo, {user?.name}</p>
        </div>
        <button 
          onClick={logout}
          className="rounded-lg bg-red-600/10 px-4 py-2 text-red-500 hover:bg-red-600/20 transition-colors"
        >
          Cerrar Sesión
        </button>
      </header>
      
      <main className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Aquí pondremos los botones de Check-in y Ventas después */}
        <div className="rounded-xl bg-slate-800 p-6 border border-slate-700">
          <h3 className="text-xl font-semibold">Estado del Sistema</h3>
          <p className="mt-2 text-green-400">Conectado al VPS: 82.25.90.140</p>
        </div>
      </main>
    </div>
  );
}

export default App;