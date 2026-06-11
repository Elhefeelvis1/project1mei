import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Edit, Search, AlertTriangle } from 'lucide-react';

const StockPage = () => {
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', genericName: '', barcode: '', category: '', unit: '',
    cost: '', markup: '', price: '', reorderLevel: '', description: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, optsRes] = await Promise.all([
        axios.get('/api/all-inventory').catch(() => ({ data: { contents: [] } })),
        axios.get('/api/stockPage')
      ]);
      setInventory(invRes.data.contents || []);
      setCategories(optsRes.data.categories || []);
      setUnits(optsRes.data.units || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCostMarkupChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    if (field === 'cost' || field === 'markup') {
      const c = parseFloat(newData.cost) || 0;
      const m = parseFloat(newData.markup) || 0;
      if (c && m) {
        newData.price = (c + (c * m / 100)).toFixed(2);
      }
    }
    setFormData(newData);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    // Assuming backend endpoint exists for adding stock (e.g. /api/addStock)
    // For now we simulate success and refresh data
    try {
      // await axios.post('/api/addStock', formData);
      alert('Product saved successfully! (Simulated - endpoint required in backend)');
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    (item.category && item.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-1">View, track, and register stock items.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium"
        >
          <Plus size={18} /> Add New Product
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search products..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm font-medium text-gray-500">{filteredInventory.length} items total</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 flex justify-center text-indigo-600"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Product Name</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium text-right">In Stock</th>
                  <th className="px-6 py-3 font-medium text-right">Cost</th>
                  <th className="px-6 py-3 font-medium text-right">Price</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  <th className="px-6 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredInventory.length > 0 ? filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.generic_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs">{item.category}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-right text-gray-700">
                      {item.total_quantity_in_stock} <span className="text-gray-400 text-xs">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">${item.last_cost_price}</td>
                    <td className="px-6 py-4 text-right font-medium text-indigo-600">${item.unit_selling_price}</td>
                    <td className="px-6 py-4 text-center">
                      {item.total_quantity_in_stock <= item.reorder_level ? (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium border border-red-100">
                          <AlertTriangle size={12} /> Low Stock
                        </span>
                      ) : (
                        <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium border border-green-100">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-gray-400 hover:text-indigo-600 transition p-1">
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      <Package size={32} className="mx-auto mb-3 opacity-30" />
                      <p>No products found in inventory.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package size={20} className="text-indigo-600" /> Register New Product
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="addForm" onSubmit={handleAddSubmit} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Brand Name</label>
                  <input type="text" required className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Generic Name</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-indigo-500 outline-none" value={formData.genericName} onChange={e => setFormData({...formData, genericName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <select required className="w-full px-3 py-2 border rounded-lg bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Select...</option>
                    {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Unit Type</label>
                  <select required className="w-full px-3 py-2 border rounded-lg bg-white" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                    <option value="">Select...</option>
                    {units.map((u, i) => <option key={i} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Cost per Unit</label>
                  <input type="number" required step="0.01" className="w-full px-3 py-2 border rounded-lg outline-none" value={formData.cost} onChange={e => handleCostMarkupChange('cost', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Mark-up (%)</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-lg outline-none" value={formData.markup} onChange={e => handleCostMarkupChange('markup', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Selling Price</label>
                  <input type="number" required step="0.01" className="w-full px-3 py-2 border rounded-lg outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Re-order Level</label>
                  <input type="number" required className="w-full px-3 py-2 border rounded-lg outline-none" value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea rows="2" className="w-full px-3 py-2 border rounded-lg outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Cancel</button>
              <button type="submit" form="addForm" className="px-6 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition shadow-sm">Save Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;
