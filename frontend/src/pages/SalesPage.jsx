import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ShoppingBag, CreditCard, User, Building, StickyNote } from 'lucide-react';
import AddCustomerModal from '../components/AddCustomerModal';
import { useOutletContext } from 'react-router-dom';
import Receipt from '../components/Receipt';
import ProductSearch from '../components/ProductSearch';
import { useToast } from '../context/ToastContext';

const SalesPage = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [banks, setBanks] = useState([]);
  const [required, setRequired] = useState(false);
  const [shopDetails, setShopDetails] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const { user } = useOutletContext() || {};

  // Cart state
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [highlightedCartRow, setHighlightedCartRow] = useState(null);

  // Checkout state
  const [paymentRoute, setPaymentRoute] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [processing, setProcessing] = useState(false);

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
        setShopDetails(res.data.shopDetails || null);
      } catch (err) {
        console.error('Failed to load initial data', err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!customerName || (selectedCustomer && customerName === selectedCustomer.name)) {
        setCustomerResults([]);
        return;
      }
      try {
        const res = await axios.get('/api/searchCustomers', { params: { customerName } });
        setCustomerResults(res.data.contents || []);
      } catch (err) {
        console.error(err);
        setCustomerResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [customerName, selectedCustomer]);

  const addToCart = (item) => {
    if (item.total_quantity_in_stock <= 0) {
      showToast('error', 'Item is out of stock.');
      return 'error';
    }
    const exists = cart.find(i => i.item_id === item.item_id);
    if (!exists) {
      setCart([...cart, { ...item, quantity: 1, selling_price: parseFloat(item.unit_selling_price || 0) }]);
      return true;
    }
    setHighlightedCartRow(item.item_id);
    setTimeout(() => setHighlightedCartRow(null), 2000);
    return false;
  };

  const updateCartQuantity = (id, newQuantity) => {
    if (newQuantity === '' || Number(newQuantity) >= 1) {
      const itemInCart = cart.find(i => i.item_id === id);
      if (itemInCart && Number(newQuantity) > itemInCart.total_quantity_in_stock) {
        showToast('error', `Cannot sell more than available stock (${itemInCart.total_quantity_in_stock}).`);
        return;
      }
      setCart(cart.map(i => i.item_id === id ? { ...i, quantity: newQuantity } : i));
    }
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
    if (cart.length === 0) return showToast('error', 'Cart is empty');
    if (!paymentRoute) return showToast('error', 'Select a payment route');
    if ((paymentRoute === 'Transfer' || paymentRoute === 'POS') && !selectedBank) return showToast('error', `Select a bank for ${paymentRoute}`);
    if (required && !selectedCustomer) return showToast('error', 'Select a customer');

    const invalidItem = cart.find(item => item.quantity === '' || Number(item.quantity) < 1);
    if (invalidItem) {
      return showToast('error', `Please enter a valid quantity for ${invalidItem.item_name}`);
    }

    setProcessing(true);

    const payload = {
      items: cart.map(item => ({
        productId: item.item_id,
        quantity: Number(item.quantity),
        sellPrice: item.selling_price
      })),
      payRoute: paymentRoute,
      bank: selectedBank || null,
      customerId: selectedCustomer?.id || null,
      totalDiscount: discountAmount,
      totalAmount: amountPayable
    };

    try {
      await axios.post('/api/process-sale', payload);

      setProcessing(false);
      showToast('success', 'Sale processed successfully!');

      const receiptData = {
        shopDetails,
        date: new Date().toLocaleString(),
        items: cart.map(item => ({ ...item, itemName: item.item_name })),
        totalAmount: total,
        totalDiscount: discountAmount,
        amountPaid: amountPayable,
        payRoute: paymentRoute,
        salesRep: user?.username
      };
      setReceiptData(receiptData);

      setCart([]);
      setDiscountPercent('');
      setDiscountValue('');
      setCustomerName('');
      setSelectedCustomer(null);
      setCustomerNotes('');

      setTimeout(() => {
        window.print();
        setTimeout(() => setReceiptData(null), 1000);
      }, 500);
    } catch (err) {
      console.error(err);
      setProcessing(false);
      showToast('error', err.response?.data?.message || 'Failed to process sale.');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    try {
      const res = await axios.put('/api/updateCustomerNotes', {
        id: selectedCustomer.id,
        notes: customerNotes
      });
      // Update local selected customer object
      setSelectedCustomer({ ...selectedCustomer, customer_notes: customerNotes });
      setCustomerNotes(res.data.customer.customer_notes || '');
      setIsNotesEditMode(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update customer notes.');
    }
  };

  const handleCustomerAdded = (newCustomer) => {
    setSelectedCustomer(newCustomer);
    setCustomerName(newCustomer.name);
    setCustomerNotes(newCustomer.customer_notes || '');
    setCustomerResults([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-gray-500 mt-1">Process new sales and manage cart.</p>
        </div>
        <button
          onClick={() => navigate('/previous-sales?today=true')}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-semibold transition shadow-sm cursor-pointer"
        >
          View Today's Sales
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Results */}
        <div className="lg:col-span-6 space-y-3">
          <ProductSearch categories={categories} onAddToCart={addToCart} />

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-7 gap-4">
              <div className="space-y-4 col-span-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                    <CreditCard size={16} /> Payment Route
                  </label>
                  <select
                    className="w-full px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
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
                {(paymentRoute === 'Transfer' || paymentRoute === 'POS') && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <Building size={16} /> Bank
                    </label>
                    <select
                      className="w-full px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
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
                    <div className='w-full relative'>
                      <div className='flex justify-start items-center'>
                        <input
                          type="text"
                          placeholder="Search name..."
                          className="w-[80%] flex-1 px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-l-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (selectedCustomer) setSelectedCustomer(null);
                          }}
                        />
                        <button
                          disabled={!customerName || customerName === "Walk in customer"}
                          onClick={() => { setIsNotesModalOpen(true); setIsNotesEditMode(false); }}
                          className={`${!customerName || customerName === "Walk in customer" ? 'cursor-not-allowed bg-gray-300' : 'bg-indigo-700 hover:shadow-md cursor-pointer'} flex justify-center items-center w-[20%] h-9 px-3 py-2 rounded-r-xl transition text-sm font-medium`}
                        >
                          <StickyNote size={16} className={`${!customerName || customerName === "Walk in customer" ? 'text-gray-700' : 'text-white'}`} />
                        </button>
                      </div>

                      {customerResults.length > 0 && !selectedCustomer && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg max-h-[100px] overflow-y-auto overflow-x-auto shadow-xl z-50">
                          {customerResults.map(c => (
                            <div
                              key={c.id}
                              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm transition whitespace-nowrap"
                              onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setCustomerNotes(c.customer_notes || ''); setCustomerResults([]); }}
                            >
                              {c.name} ({c.phone_number})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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

              <div className="space-y-3 px-4 py-2 col-span-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">₦{total.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Disc %"
                      className="w-full px-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                      value={discountPercent}
                      onChange={(e) => { setDiscountPercent(e.target.value); setDiscountValue(''); }}
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Disc ₦"
                      className="w-full px-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
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
                disabled={processing}
                onClick={handleCheckout}
                className={`flex-1 px-6 py-3 text-white font-bold rounded-xl transition shadow-lg ${processing ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200"}`}
              >
                {processing ? "Processing..." : "Complete Sale"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
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
                      <tr key={item.item_id} className={`transition-colors ${highlightedCartRow === item.item_id ? 'bg-yellow-100' : 'bg-white hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{item.item_name}</td>
                        <td className="px-4 py-3 text-gray-600">₦{item.selling_price}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 w-max">
                              <button
                                className="px-2 py-1 hover:bg-gray-200 text-gray-600 transition"
                                onClick={() => updateCartQuantity(item.item_id, item.quantity - 1)}
                              >-</button>
                              <input
                                type="number"
                                required
                                className="px-2 py-1 bg-white font-medium w-16 text-center border-x border-gray-200 outline-none appearance-none m-0"
                                value={item.quantity}
                                onChange={(e) => updateCartQuantity(item.item_id, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                              />
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
      <Receipt receiptData={receiptData} />
    </div>
  );
};

export default SalesPage;
