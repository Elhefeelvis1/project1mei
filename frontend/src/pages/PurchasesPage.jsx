import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Trash2, ShoppingCart, Truck } from 'lucide-react';

const PurchasesPage = () => {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState({ itemName: '', category: '', minPrice: '', maxPrice: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [salesRes, purchRes] = await Promise.all([
          axios.get('/api/salesPage'),
          axios.get('/api/purchasePage')
        ]);
        setCategories(salesRes.data.categories || []);
        setSuppliers(purchRes.data.suppliers || []);
      } catch (err) {
        console.error('Failed to load initial data', err);
      }
    };
    fetchInitialData();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const res = await axios.get('/api/searchItems', { params: searchQuery });
      setSearchResults(res.data.contents || []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
      alert('Search failed or no items found.');
    } finally {
      setIsSearching(false);
    }
  };

  const addToCart = (item) => {
    const exists = cart.find(i => i.id === item.id);
    if (!exists) {
      setCart([...cart, { 
        ...item, 
        quantity: 1, 
        unit_cost: parseFloat(item.last_cost_price || 0),
        unit_price: parseFloat(item.unit_selling_price || 0),
        expiry_date: ''
      }]);
    }
  };

  const updateCartItem = (id, field, value) => {
    setCart(cart.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => i.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (parseFloat(item.unit_cost) * parseInt(item.quantity || 0)), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!selectedSupplier) return alert('Select a supplier');

    const payload = {
      supplierId: selectedSupplier,
      items: cart
    };

    try {
      await axios.post('/api/process-purchase', payload);
      alert('Purchase processed successfully!');
      setCart([]);
      setSelectedSupplier('');
    } catch (err) {
      console.error(err);
      alert('Failed to process purchase.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Order</h1>
          <p className="text-gray-500 mt-1">Receive new stock from suppliers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Results */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search size={20} className="text-indigo-500" /> Item Search
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Item Name..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={searchQuery.itemName}
                  onChange={(e) => setSearchQuery({...searchQuery, itemName: e.target.value})}
                />
              </div>
              <select 
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white"
                value={searchQuery.category}
                onChange={(e) => setSearchQuery({...searchQuery, category: e.target.value})}
              >
                <option value="">All Categories</option>
                {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
              </select>
              <button 
                type="submit" 
                disabled={isSearching}
                className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                {isSearching ? 'Searching...' : 'Search Items'}
              </button>
            </form>

            <div className="mt-6 max-h-[400px] overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-2 pr-2">
                  {searchResults.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{item.name}</h4>
                        <p className="text-xs text-gray-500">{item.total_quantity_in_stock} in stock</p>
                      </div>
                      <button 
                        onClick={() => addToCart(item)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm">No items found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Order List & Checkout */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <ShoppingCart size={20} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-800">Incoming Stock</h2>
            <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-sm font-semibold">
              {cart.length} items
            </span>
          </div>
          
          <div className="flex-1 overflow-x-auto p-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Truck size={48} className="mb-4 opacity-20" />
                <p>Select items to receive stock.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium w-24">Qty</th>
                    <th className="px-4 py-3 font-medium w-32">Unit Cost</th>
                    <th className="px-4 py-3 font-medium w-32">Sell Price</th>
                    <th className="px-4 py-3 font-medium w-40">Exp Date</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-center w-16">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {cart.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3">
                        <input type="number" min="1" className="w-full px-2 py-1 border rounded" value={item.quantity} onChange={(e) => updateCartItem(item.id, 'quantity', e.target.value)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-1">₦</span>
                          <input type="number" step="0.01" className="w-full px-2 py-1 border rounded" value={item.unit_cost} onChange={(e) => updateCartItem(item.id, 'unit_cost', e.target.value)} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-1">₦</span>
                          <input type="number" step="0.01" className="w-full px-2 py-1 border rounded" value={item.unit_price} onChange={(e) => updateCartItem(item.id, 'unit_price', e.target.value)} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" className="w-full px-2 py-1 border rounded" value={item.expiry_date} onChange={(e) => updateCartItem(item.id, 'expiry_date', e.target.value)} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-indigo-600">
                        ₦{(parseFloat(item.unit_cost || 0) * parseInt(item.quantity || 0)).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-white rounded-b-xl flex gap-6 items-center">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Supplier</label>
              <select 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-indigo-500 outline-none"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">(Select Supplier)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col items-end px-6 border-x border-gray-100">
              <span className="text-sm text-gray-500 font-medium">Total Purchase</span>
              <span className="text-2xl font-black text-gray-900">₦{total.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setCart([])}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-medium rounded-lg transition"
              >
                Clear
              </button>
              <button 
                onClick={handleCheckout}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition shadow-md shadow-indigo-200"
              >
                Save Purchase
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchasesPage;
