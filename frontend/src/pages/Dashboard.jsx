import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Users, DollarSign, Package } from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState({ users: [], recentSales: [], recentPurchases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">Welcome back. Here's what's happening today.</p>
      </div>

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
                    <td className="px-6 py-4 text-sm text-gray-600">${sale.unit_selling_price}</td>
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
                        {u.username.substring(0,2).toUpperCase()}
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
    </div>
  );
};

export default Dashboard;
