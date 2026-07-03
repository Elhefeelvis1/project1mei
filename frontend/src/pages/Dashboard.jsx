import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { TrendingUp, Users, DollarSign, Package, Settings, Save } from 'lucide-react';

const Dashboard = () => {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [data, setData] = useState({ users: [], recentSales: [], recentPurchases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [shopDetails, setShopDetails] = useState({ shopName: '', shopAddress: '', shopPhone: '', shopEmail: '', shopLogo: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'shopInfo') {
      axios.get('/api/shopDetails').then(res => setShopDetails(res.data)).catch(console.error);
    }
  }, [activeTab]);

  const handleSaveShopDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/shopDetails', shopDetails);
      alert('Shop details updated successfully!');
    } catch (err) {
      alert('Failed to update shop details.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      if (user?.role !== 'administrator') {
        navigate('/home');
        return;
      }

      try {
        const response = await axios.get('/api/dashboard');
        setData(response.data);
      } catch (err) {
        setError('Failed to load dashboard data. Are you logged in?');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
        {error}
      </div>
    );
  }

  const statCards = [
    { title: 'Total Sales', value: data.recentSales.length, icon: <TrendingUp size={24} className="text-emerald-500" />, bg: 'bg-emerald-50' },
    { title: 'Registered Users', value: data.users.length, icon: <Users size={24} className="text-blue-500" />, bg: 'bg-blue-50' },
    { title: 'Recent Purchases', value: data.recentPurchases.length, icon: <Package size={24} className="text-amber-500" />, bg: 'bg-amber-50' },
    { title: 'Revenue', value: 'N/A', icon: <DollarSign size={24} className="text-indigo-500" />, bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back. Manage your shop and view metrics.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Overview</button>
          <button onClick={() => setActiveTab('shopInfo')} className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'shopInfo' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Shop Info</button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md duration-200">
                <div className={`p-4 rounded-lg ${stat.bg}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">Recent Sales</h2>
                <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Product</th>
                      <th className="px-6 py-3 font-medium">Quantity</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentSales.length > 0 ? data.recentSales.slice(0, 5).map((sale, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{sale.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{Math.abs(sale.quantity_change)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">₦{sale.unit_selling_price}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500">No recent sales found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">System Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Username</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.users.length > 0 ? data.users.map((u, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          {u.username}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'administrator' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="2" className="px-6 py-8 text-center text-gray-500">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>)}

      {activeTab === 'shopInfo' && (
        <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Settings size={20} className="text-indigo-500" /> Shop Settings
          </h2>
          <form onSubmit={handleSaveShopDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopName || ''} onChange={e => setShopDetails({ ...shopDetails, shopName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Address</label>
              <textarea className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopAddress || ''} onChange={e => setShopDetails({ ...shopDetails, shopAddress: e.target.value })} required rows="2"></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopPhone || ''} onChange={e => setShopDetails({ ...shopDetails, shopPhone: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopEmail || ''} onChange={e => setShopDetails({ ...shopDetails, shopEmail: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Logo URL</label>
              <input type="url" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopLogo || ''} onChange={e => setShopDetails({ ...shopDetails, shopLogo: e.target.value })} />
            </div>
            <div className="pt-4 border-t border-gray-100">
              <button type="submit" disabled={saving} className="bg-indigo-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2">
                <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
