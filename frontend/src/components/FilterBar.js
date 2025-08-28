import { useState } from 'react';

function FilterBar({ filters, onFilterChange }) {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleSourceChange = (source) => {
    const newFilters = { ...localFilters, source };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleLimitChange = (limit) => {
    const newFilters = { ...localFilters, limit };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-3">Filters</h2>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Source</label>
          <select 
            value={localFilters.source} 
            onChange={(e) => handleSourceChange(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All</option>
            <option value="github">GitHub</option>
            <option value="stackoverflow">StackOverflow</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Items to show</label>
          <select 
            value={localFilters.limit} 
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default FilterBar;