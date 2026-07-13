import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, FileText, LogOut,
  Wrench, History, ChevronLeft, ChevronRight, Settings, UserCog, Locate, ChartNoAxesCombined, Home, Tags
} from 'lucide-react';
import axios from 'axios';

const Sidebar = ({ user, isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      navigate('/login');
    } catch (err) {
      console.error(err);
      navigate('/login');
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <ChartNoAxesCombined size={20} /> },
    { name: 'Transactions', path: '/transactions', icon: <FileText size={20} /> },
    { name: 'Internal Updates', path: '/internal-updates', icon: <Wrench size={20} /> },
    { name: 'Stock', path: '/stock', icon: <Package size={20} /> },
    { name: 'Product Tracker', path: '/tracker', icon: <Locate size={20} /> },
    { name: 'Previous Sales', path: '/previous-sales', icon: <History size={20} /> },
    { name: 'Customers', path: '/customers', icon: <Users size={20} /> },
    { name: 'User Settings', path: '/user-settings', icon: <UserCog size={20} /> },
  ];

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-[#1e293b] text-white flex flex-col fixed top-0 bottom-0 left-0 min-h-screen shadow-xl transition-all duration-300 z-20`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-5 bg-indigo-600 rounded-full p-1 shadow-lg text-white hover:bg-indigo-500 transition-colors border border-indigo-700 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-6'} border-b border-gray-700 bg-[#0f172a]`}>
        {isCollapsed ? (
          <Link to="/home" className="text-xl font-bold tracking-tight text-indigo-400">SK</Link>
        ) : (
          <Link to="/home" className="text-2xl font-bold tracking-tight text-indigo-400">ShopKeeper</Link>
        )}
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600">
        <Link
          key="home"
          to="/home"
          title={isCollapsed ? "Home" : undefined}
          className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${location.pathname === "/home"
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
        >
          <div className="flex-shrink-0"><Home size={20} /></div>
          {!isCollapsed && <span className="font-medium whitespace-nowrap">Home</span>}
        </Link>
        {navItems.filter(item => {
          if (user?.role === 'administrator') return true;
          return item.path === '/sales' || item.path === '/purchases';
        }).map((item) => (
          <Link
            key={item.name}
            to={item.path}
            title={isCollapsed ? item.name : undefined}
            className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${location.pathname === item.path
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <div className="shrink-0">{item.icon}</div>
            {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.name}</span>}
          </Link>
        ))}
        <Link
          key="account-settings"
          to="/account-settings"
          title={isCollapsed ? "Account Settings" : undefined}
          className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-4'} ${location.pathname === "/account-settings"
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
        >
          <div className="flex-shrink-0"><Settings size={20} /></div>
          {!isCollapsed && <span className="font-medium whitespace-nowrap">Account Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 py-3 mt-4 rounded-lg transition-colors bg-red-500 hover:bg-red-600 text-white shadow-md ${isCollapsed ? 'px-0 justify-center' : 'px-4'}`}
        >
          <div className="flex-shrink-0"><LogOut size={20} /></div>
          {!isCollapsed && <span className="font-medium whitespace-nowrap">Logout</span>}
        </button>
      </nav>
    </div>
  );
};

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      navigate('/login');
    } catch (err) {
      console.error(err);
      navigate('/login');
    }
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-8 shadow-sm fixed top-0 right-0 left-0 z-10">
      <div className="flex items-center gap-6">
        <Link to="/home" className="text-xl font-semibold text-gray-800">ShopKeeper Portal</Link>
        {user === "administrator" && (location.pathname === '/sales' || location.pathname === '/purchases') && (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
          >
            &larr; Back to Dashboard
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors px-3 py-2 rounded-md hover:bg-red-50"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm cursor-pointer">Logout</span>
        </button>
      </div>
    </header>
  );
};

const Layout = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get('/api/me');
        if (res.data.authenticated) {
          setUser(res.data.user);
        } else {
          navigate('/login');
        }
      } catch (err) {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const isSales = location.pathname === '/sales';
  const isPurchase = location.pathname === '/purchases'

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {!isSales && !isPurchase && <Sidebar user={user} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {(isSales || isPurchase) && <Navbar user={user} />}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-8 ${(!isSales && !isPurchase) ? isCollapsed ? 'pl-26' : 'pl-70' : ''} ${(isSales || isPurchase) ? 'pt-18' : ''}`}>
          <Outlet context={{ user }} />
        </main>
      </div>
    </div >
  );
};

export default Layout;
