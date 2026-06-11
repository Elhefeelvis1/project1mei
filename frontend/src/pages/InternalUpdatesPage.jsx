import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, PackageMinus, Trash2, RotateCcw, AlertOctagon, Building, PackageX } from 'lucide-react';

const InternalUpdatesPage = () => {
  const [categories, setCategories] = useState([]);
  const [updateType, setUpdateType] = useState('Return'); // Return, Expired, Office Use, Damaged

  const [searchQuery, setSearchQuery] = useState({ itemName: '', category: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/salesPage');
        setCategories(res.data.categories || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const res = await axios.get('/api/searchItems', { params: searchQuery });
      setSearchResults(res.data.contents || []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addToCart = (item) => {
    const exists = cart.find(i => i.item_id === item.item_id);
    if (!exists) {
      setCart([...cart, {
        ...item,
        productId: item.item_id,
        quantity: 1,
        expiryDate: ''
      }]);
    }
  };

  const updateCartItem = (id, field, value) => {
    setCart(cart.map(i => i.item_id === id ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => i.item_id !== id));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return alert('No items selected.');

    let endpoint = '';
    switch (updateType) {
      case 'Return': endpoint = '/api/process-return'; break;
      case 'Expired': endpoint = '/api/process-expired'; break;
      case 'Office Use': endpoint = '/api/process-office-use'; break;
      case 'Damaged': endpoint = '/api/process-damaged'; break;
      default: return alert('Invalid update type.');
    }

    try {
      await axios.post(endpoint, { items: cart });
      alert(`${updateType} processed successfully!`);
      setCart([]);
    } catch (err) {
      console.error(err);
      alert(`Failed to process ${updateType}: ${err.response?.data?.message || err.message}`);
    }
  };

  const getTypeIcon = () => {
    switch (updateType) {
      case 'Return': return <RotateCcw size={20} className="text-indigo-500" />;
      case 'Expired': return <AlertOctagon size={20} className="text-red-500" />;
      case 'Office Use': return <Building size={20} className="text-blue-500" />;
      case 'Damaged': return <PackageX size={20} className="text-orange-500" />;
      default: return <PackageMinus size={20} className="text-gray-500" />;
    }
  };

  const getTypeColor = () => {
    switch (updateType) {
      case 'Return': return 'bg-indigo-600 hover:bg-indigo-700';
      case 'Expired': return 'bg-red-600 hover:bg-red-700';
      case 'Office Use': return 'bg-blue-600 hover:bg-blue-700';
      case 'Damaged': return 'bg-orange-600 hover:bg-orange-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Internal Stock Updates</h1>
          <p className="text-gray-500 mt-1">Manage returns, expired items, office use, and damages.</p>
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 inline-flex">
          {['Return', 'Expired', 'Office Use', 'Damaged'].map(type => (
            <button
              key={type}
              onClick={() => { setUpdateType(type); setCart([]); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${updateType === type ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search size={20} className="text-gray-500" /> Item Search
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <input
                type="text"
                placeholder="Item Name..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 outline-none"
                value={searchQuery.itemName}
                onChange={(e) => setSearchQuery({ ...searchQuery, itemName: e.target.value })}
              />
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white outline-none"
                value={searchQuery.category}
                onChange={(e) => setSearchQuery({ ...searchQuery, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
              </select>
              <button
                type="submit"
                disabled={isSearching}
                className="w-full bg-gray-800 text-white font-medium py-2 rounded-lg hover:bg-gray-900 transition"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="mt-6 max-h-[400px] overflow-y-auto">
              {searchResults.length > 0 && (
                <div className="space-y-2 pr-2">
                  {searchResults.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{item.item_name}</h4>
                        <p className="text-xs text-gray-500">{item.total_quantity_in_stock} {item.unit_name} in stock</p>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 text-sm"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-160px)] max-h-[700px]">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            {getTypeIcon()}
            <h2 className="text-lg font-bold text-gray-800">Process {updateType}</h2>
            <span className="ml-auto bg-gray-200 text-gray-700 py-1 px-3 rounded-full text-sm font-semibold">
              {cart.length} items
            </span>
          </div>

          <div className="flex-1 overflow-x-auto p-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <PackageMinus size={48} className="mb-4 opacity-20" />
                <p>Add items to process {updateType.toLowerCase()}.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-3 font-medium">Item</th>
                    <th className="px-6 py-3 font-medium w-32">Qty</th>
                    {updateType === 'Return' && <th className="px-6 py-3 font-medium w-48">Exp Date (Lot ID)</th>}
                    <th className="px-6 py-3 font-medium text-center w-20">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {cart.map((item) => (
                    <tr key={item.item_id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4">
                        <input type="number" min="1" className="w-full px-3 py-1.5 border border-gray-200 rounded-md outline-none focus:border-gray-400" value={item.quantity} onChange={(e) => updateCartItem(item.item_id, 'quantity', e.target.value)} />
                      </td>
                      {updateType === 'Return' && (
                        <td className="px-6 py-4">
                          <input type="date" required className="w-full px-3 py-1.5 border border-gray-200 rounded-md outline-none focus:border-gray-400" value={item.expiryDate} onChange={(e) => updateCartItem(item.item_id, 'expiryDate', e.target.value)} />
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => removeFromCart(item.item_id)} className="text-gray-400 hover:text-red-500 p-1 transition">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
            <button
              onClick={() => setCart([])}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              className={`px-8 py-2 text-white font-bold rounded-lg shadow-sm transition ${getTypeColor()}`}
            >
              Confirm {updateType}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalUpdatesPage;
