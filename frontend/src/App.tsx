
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import KeyWins from './components/KeyWins';
import DailyUpdates from './components/DailyUpdates';
import './index.css';

function App() {
  const location = useLocation();
  return (
    <div className="App">
      <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">StoreHub</span>
            <nav className="flex gap-3">
              <NavLink to="/" end className={({isActive}) => `text-sm px-3 py-1.5 rounded ${isActive ? 'bg-orange-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}>Funnel</NavLink>
              <NavLink to="/wins" className={({isActive}) => `text-sm px-3 py-1.5 rounded ${isActive ? 'bg-orange-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}>Key Wins</NavLink>
              <NavLink to="/daily" className={({isActive}) => `text-sm px-3 py-1.5 rounded ${isActive ? 'bg-orange-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}>Daily Update</NavLink>
            </nav>
          </div>
          <div className="text-xs text-gray-500">{location.pathname}</div>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/wins" element={<KeyWins />} />
        <Route path="/daily" element={<DailyUpdates />} />
      </Routes>
    </div>
  );
}

export default App;
