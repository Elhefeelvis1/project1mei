import React from 'react';
import { format } from 'date-fns';

const DateRangeFilter = ({ startDate, setStartDate, endDate, setEndDate }) => {
  return (
    <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600 pl-2">From:</label>
        <input 
          type="date" 
          value={format(startDate, 'yyyy-MM-dd')}
          onChange={(e) => setStartDate(new Date(e.target.value))}
          className="text-sm px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-700"
        />
      </div>
      <div className="flex items-center gap-2 pr-2">
        <label className="text-sm font-medium text-gray-600">To:</label>
        <input 
          type="date" 
          value={format(endDate, 'yyyy-MM-dd')}
          onChange={(e) => setEndDate(new Date(e.target.value))}
          className="text-sm px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-700"
        />
      </div>
    </div>
  );
};

export default DateRangeFilter;
