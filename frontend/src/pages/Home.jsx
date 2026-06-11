import { useNavigate, useOutletContext } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard } from 'lucide-react';

const Home = () => {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const handleAdminDashboard = (e) => {
    e.preventDefault();
    if (user?.role === 'administrator') {
      navigate('/dashboard');
    } else {
      alert("Access Denied: User is not an Admin");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 bg-white rounded-xl shadow-sm border border-gray-100 p-12">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Welcome to ShopKeeper{user ? `, ${user.username}` : ''}
        </h1>
        <p className="text-lg text-gray-500">Select a portal to continue</p>
      </div>
      
      <div className="flex gap-6 mt-8">
        <button 
          onClick={() => navigate('/sales')}
          className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition w-64 group"
        >
          <div className="p-5 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
            <ShoppingCart size={48} />
          </div>
          <span className="text-xl font-bold text-gray-800">Sales Portal</span>
        </button>
        
        <button 
          onClick={handleAdminDashboard}
          className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:border-purple-100 transition w-64 group"
        >
          <div className="p-5 bg-purple-50 text-purple-600 rounded-full group-hover:scale-110 transition-transform">
            <LayoutDashboard size={48} />
          </div>
          <span className="text-xl font-bold text-gray-800">Admin Dashboard</span>
        </button>
      </div>
    </div>
  );
};

export default Home;
