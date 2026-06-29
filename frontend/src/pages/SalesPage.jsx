import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ShoppingBag, CreditCard, User, Building, Package } from 'lucide-react';
import AddCustomerModal from '../components/AddCustomerModal';

const SalesPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [banks, setBanks] = useState([]);
  const [required, setRequired] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState({ itemName: '', category: '', minPrice: '', maxPrice: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Cart state
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountValue, setDiscountValue] = useState('');

  // Checkout state
  const [paymentRoute, setPaymentRoute] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Customer notes state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isNotesEditMode, setIsNotesEditMode] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await axios.get('/api/salesPage');
        setCategories(res.data.categories || []);
        setBanks(res.data.banks || []);
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

  const handleCustomerSearch = async (e) => {
    e.preventDefault();
    if (!customerName) return;
    try {
      const res = await axios.get('/api/searchCustomers', { params: { customerName } });
      setCustomerResults(res.data.contents || []);
    } catch (err) {
      console.error(err);
      setCustomerResults([]);
    }
  };

  const addToCart = (item) => {
    const exists = cart.find(i => i.item_id === item.item_id);
    if (!exists) {
      setCart([...cart, { ...item, quantity: 1, selling_price: parseFloat(item.unit_selling_price || 0) }]);
    }
  };

  const updateCartQuantity = (id, newQuantity) => {
    if (newQuantity < 1) return;
    setCart(cart.map(i => i.item_id === id ? { ...i, quantity: newQuantity } : i));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => i.item_id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.selling_price * item.quantity), 0);

  // Calculate discount
  let discountAmount = 0;
  if (discountValue) {
    discountAmount = parseFloat(discountValue) || 0;
  } else if (discountPercent) {
    discountAmount = total * ((parseFloat(discountPercent) || 0) / 100);
  }

  const amountPayable = Math.max(0, total - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!paymentRoute) return alert('Select a payment route');
    if (paymentRoute === 'Transfer' && !selectedBank) return alert('Select a bank for transfer');
    if (required && !selectedCustomer) return alert('Select a customer');

    const payload = {
      items: cart.map(item => ({
        productId: item.item_id,
        quantity: item.quantity,
        sellPrice: item.selling_price
      })),
      payRoute: paymentRoute,
      bank: selectedBank,
      customerId: selectedCustomer?.id || null,
      totalDiscount: discountAmount,
      totalAmount: amountPayable
    };

    try {
      await axios.post('/api/process-sale', payload);
      alert('Sale processed successfully!');
      setCart([]);
      setDiscountPercent('');
      setDiscountValue('');
      setCustomerName('');
      setSelectedCustomer(null);
      setCustomerNotes('');
    } catch (err) {
      console.error(err);
      alert('Failed to process sale.');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    try {
      await axios.put('/api/updateCustomerNotes', {
        id: selectedCustomer.id,
        notes: customerNotes
      });
      // Update local selected customer object
      setSelectedCustomer({ ...selectedCustomer, customer_notes: customerNotes });
      setIsNotesEditMode(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update customer notes.');
    }
  };

  const handleCustomerAdded = (newCustomer) => {
    setSelectedCustomer(newCustomer);
    setCustomerName(newCustomer.name);
    setCustomerNotes(newCustomer.customer_notes || '');
    setCustomerResults([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-gray-500 mt-1">Process new sales and manage cart.</p>
        </div>
        <button
          onClick={() => navigate('/previous-sales?today=true')}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-semibold transition shadow-sm"
        >
          View Today's Sales
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Results */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search size={20} className="text-indigo-500" /> Product Search
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Item Name..."
                  className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                  value={searchQuery.itemName}
                  onChange={(e) => setSearchQuery({ ...searchQuery, itemName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select
                  className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                  value={searchQuery.category}
                  onChange={(e) => setSearchQuery({ ...searchQuery, category: e.target.value })}
                >
                  <option value="">All Categories</option>
                  {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                </select>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-70"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            <div className="mt-6 max-h-[400px] overflow-y-auto pr-2">
              {searchResults.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Stock</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {searchResults.map((item, idx) => (
                        <tr
                          key={idx}
                          onClick={() => addToCart(item)}
                          className="hover:bg-indigo-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-gray-800">{item.item_name}</td>
                          <td className="px-4 py-3 text-gray-500">{item.category_name}</td>
                          <td className="px-4 py-3 text-gray-500">{item.total_quantity_in_stock} {item.unit_name} left</td>
                          <td className="px-4 py-3 font-bold text-indigo-600">₦{item.unit_selling_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Search for products to add to cart</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2">
            <ShoppingBag size={20} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-800">Current Order</h2>
            <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-sm font-semibold">
              {cart.length} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={48} className="mb-4 opacity-20" />
                <p>Your cart is empty.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium text-center">Qty</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((item) => (
                      <tr key={item.item_id} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-800">{item.item_name}</td>
                        <td className="px-4 py-3 text-gray-600">₦{item.selling_price}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 w-max">
                              <button
                                className="px-2 py-1 hover:bg-gray-200 text-gray-600 transition"
                                onClick={() => updateCartQuantity(item.item_id, item.quantity - 1)}
                              >-</button>
                              <span className="px-2 py-1 bg-white font-medium min-w-[2.5rem] text-center border-x border-gray-200">{item.quantity}</span>
                              <button
                                className="px-2 py-1 hover:bg-gray-200 text-gray-600 transition"
                                onClick={() => updateCartQuantity(item.item_id, item.quantity + 1)}
                              >+</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">₦{(item.selling_price * item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeFromCart(item.item_id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-white rounded-b-xl space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                    <CreditCard size={16} /> Payment Route
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                    value={paymentRoute}
                    onChange={(e) => {
                      setPaymentRoute(e.target.value)
                      e.target.value === "Credit" && setRequired(true)
                    }}
                  >
                    <option value="">Select Route</option>
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                    <option value="POS">POS</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
                {paymentRoute === 'Transfer' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <Building size={16} /> Bank
                    </label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      <option value="">Select Bank</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                    <User size={16} /> Customer {required ? <span className="text-red-500">(Required)</span> : <span className="text-gray-500">(Optional)</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search name..."
                      className="flex-1 px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <button onClick={handleCustomerSearch} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium">Search</button>
                    {customerName && customerName !== "Walk in customer" && (
                      <button
                        onClick={() => { setIsNotesModalOpen(true); setIsNotesEditMode(false); }}
                        className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition text-sm font-medium whitespace-nowrap shadow-sm"
                      >
                        Notes
                      </button>
                    )}
                  </div>
                  {customerResults.length > 0 && !selectedCustomer && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-32 overflow-y-auto shadow-sm">
                      {customerResults.map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm transition"
                          onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setCustomerNotes(c.customer_notes || ''); setCustomerResults([]); }}
                        >
                          {c.name} ({c.phone_number})
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 border-dashed rounded-lg transition text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Add New Customer
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">₦{total.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Disc %"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                      value={discountPercent}
                      onChange={(e) => { setDiscountPercent(e.target.value); setDiscountValue(''); }}
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Disc ₦"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                      value={discountValue}
                      onChange={(e) => { setDiscountValue(e.target.value); setDiscountPercent(''); }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-indigo-600">
                  <span>Discount</span>
                  <span className="font-medium">-₦{discountAmount.toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex justify-between items-center mt-2">
                  <span className="text-lg font-bold text-gray-800">Total</span>
                  <span className="text-2xl font-black text-gray-900">₦{amountPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setCart([])}
                className="px-6 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition"
              >
                Clear
              </button>
              <button
                onClick={handleCheckout}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        onSuccess={handleCustomerAdded}
      />

      {/* Customer Notes Modal */}
      {isNotesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <User size={20} className="text-indigo-500" />
                Customer Notes: {selectedCustomer ? selectedCustomer.name : customerName}
              </h3>
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {isNotesEditMode ? (
                <textarea
                  className="w-full h-48 p-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-gray-400"
                  placeholder="Enter customer notes, prescriptions, preferences, etc..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl min-h-[12rem] whitespace-pre-wrap text-gray-700 border border-gray-100">
                  {customerNotes || <span className="text-gray-400 italic">No notes available for this customer.</span>}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition"
              >
                Close
              </button>
              {isNotesEditMode ? (
                <button
                  onClick={handleSaveNotes}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm"
                >
                  Save Notes
                </button>
              ) : (
                <button
                  onClick={() => setIsNotesEditMode(true)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium rounded-lg hover:bg-indigo-100 transition shadow-sm"
                >
                  Edit Notes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;
