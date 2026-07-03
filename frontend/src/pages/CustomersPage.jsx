import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Edit2, Search } from 'lucide-react';
import AddCustomerModal from '../components/AddCustomerModal';

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/allCustomers');
      if (res.data.success) {
        setCustomers(res.data.contents);
        setFilteredCustomers(res.data.contents);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c =>
          (c.name && c.name.toLowerCase().includes(lowerQ)) ||
          (c.phone_number && String(c.phone_number).includes(lowerQ)) ||
          (c.email && c.email.toLowerCase().includes(lowerQ))
        )
      );
    }
  }, [searchQuery, customers]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (savedCustomer) => {
    fetchCustomers();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer database.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
        >
          <Plus size={20} /> Add New Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <Users size={48} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium">No customers found</p>
            <p className="text-sm">Try adding a new customer or changing your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Phone Number</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Address</th>
                  <th className="px-6 py-4 font-semibold">Notes</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{customer.name}</td>
                    <td className="px-6 py-4 text-gray-600">{customer.phone_number || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]" title={customer.address}>{customer.address || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]" title={customer.customer_notes}>{customer.customer_notes || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(customer)}
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                        title="Edit Customer"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialData={editingCustomer}
      />
    </div>
  );
};

export default CustomersPage;
