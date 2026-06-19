import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Edit, Search, AlertTriangle, Tag, Scale, DollarSign, Percent, AlertCircle, FileText } from 'lucide-react';

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
  const [ItemOnEdit, setItemOnEdit] = useState(null);

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

  const handlePricingChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    const cost = parseFloat(newData.cost) || 0;
    const markup = parseFloat(newData.markup) || 0;
    const price = parseFloat(newData.price) || 0;

    if (field === 'cost' || field === 'markup') {
      if (cost > 0) {
        newData.price = (cost + (cost * markup / 100)).toFixed(2);
      }
    } else if (field === 'price') {
      if (cost > 0 && price > 0) {
        newData.markup = (((price - cost) / cost) * 100).toFixed(1);
      }
    }
    setFormData(newData);
  };

  const handleAddNewClick = () => {
    setItemOnEdit(null);
    setFormData({
      name: '', genericName: '', barcode: '', category: '', unit: '',
      cost: '', markup: '', price: '', reorderLevel: '', description: ''
    });
    setShowAddModal(true);
  };

  const handleEditClick = (item) => {
    setItemOnEdit(item);
    const cost = parseFloat(item.last_cost_price) || 0;
    const price = parseFloat(item.unit_selling_price) || 0;
    const markup = cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : '0';

    setFormData({
      name: item.name || '',
      genericName: item.generic_name || '',
      barcode: item.barcode || '',
      category: item.category || '',
      unit: item.unit || '',
      cost: cost || '',
      markup: markup || '',
      price: price || '',
      reorderLevel: item.reorder_level || '',
      description: item.description || ''
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setItemOnEdit(null);
    setFormData({
      name: '', genericName: '', barcode: '', category: '', unit: '',
      cost: '', markup: '', price: '', reorderLevel: '', description: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (ItemOnEdit) {
        // Simulation or actual request to update item
        // await axios.put('/api/update-item', { id: ItemOnEdit.id, ...formData });
        alert('Product updated successfully! (Simulated - endpoint required in backend)');
      } else {
        // Simulation or actual request to add item
        // await axios.post('/api/addStock', formData);
        alert('Product saved successfully! (Simulated - endpoint required in backend)');
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert(ItemOnEdit ? 'Failed to update product' : 'Failed to save product');
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
          onClick={handleAddNewClick}
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
                    <td className="px-6 py-4 text-right text-gray-600">₦{item.last_cost_price}</td>
                    <td className="px-6 py-4 text-right font-medium text-indigo-600">₦{item.unit_selling_price}</td>
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
                      <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-indigo-600 transition p-1">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-100 rounded-3xl border border-slate-300 shadow-2xl shadow-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] transform transition-all">
            <div className="px-8 py-5 border-b border-slate-300 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
                {ItemOnEdit ? (
                  <>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Edit size={20} />
                    </div>
                    <span>Edit Product <span className="text-slate-400 font-medium">{ItemOnEdit.name}</span></span>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Package size={20} />
                    </div>
                    <span>Register New Product</span>
                  </>
                )}
              </h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 overflow-y-auto">
              <form id="addForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-slate-400" /> Brand Name
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Panadol"
                      className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" /> Generic Name
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol"
                      className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                      value={formData.genericName}
                      onChange={e => setFormData({ ...formData, genericName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} className="text-slate-400" /> Category
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                      <Tag size={16} />
                    </div>
                    <select
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 text-sm font-medium appearance-none cursor-pointer"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale size={14} className="text-slate-400" /> Unit Type
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                      <Scale size={16} />
                    </div>
                    <select
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 text-sm font-medium appearance-none cursor-pointer"
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="">Select Unit...</option>
                      {units.map((u, i) => <option key={i} value={u.name}>{u.name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={14} className="text-slate-400" /> Cost per Unit
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm group-focus-within:text-indigo-600 transition-colors">
                      ₦
                    </div>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                      value={formData.cost}
                      onChange={e => handlePricingChange('cost', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent size={14} className="text-slate-400" /> Mark-up (%)
                  </label>
                  <div className="relative group">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-4 pr-10 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                      value={formData.markup}
                      onChange={e => handlePricingChange('markup', e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm group-focus-within:text-indigo-600 transition-colors">
                      %
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={14} className="text-slate-400" /> Selling Price
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm group-focus-within:text-indigo-600 transition-colors">
                      ₦
                    </div>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                      value={formData.price}
                      onChange={e => handlePricingChange('price', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-slate-400" /> Re-order Level
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                      <AlertCircle size={16} />
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 10"
                      className="w-full pl-10 pr-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                      value={formData.reorderLevel}
                      onChange={e => setFormData({ ...formData, reorderLevel: e.target.value })}
                    />
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" /> Description
                  </label>
                  <div className="relative group">
                    <textarea
                      rows="3"
                      placeholder="Optional product description..."
                      className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium resize-none"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="px-8 py-5 border-t border-slate-300 flex justify-end gap-3.5 bg-slate-50/50">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-500 hover:text-white rounded-xl transition-all duration-150 cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="addForm"
                className={`px-7 py-2.5 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm ${ItemOnEdit
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200/50'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-200/50'
                  }`}
              >
                {ItemOnEdit ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;
