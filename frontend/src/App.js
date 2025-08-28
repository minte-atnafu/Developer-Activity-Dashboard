import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import ActivityFeed from './components/ActivityFeed';
import FilterBar from './components/FilterBar';
import './App.css';

const GET_ACTIVITIES = gql`
  query GetActivities($source: String, $limit: Int) {
    activities(source: $source, limit: $limit) {
      id
      type
      source
      title
      description
      url
      timestamp
      repoName
      tags
    }
  }
`;

function App() {
  const [filters, setFilters] = useState({
    source: '',
    limit: 20
  });

  const { loading, error, data, refetch } = useQuery(GET_ACTIVITIES, {
    variables: filters
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    refetch(newFilters);
  };

  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Developer Activity Dashboard</h1>
      
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      {loading ? (
        <p className="text-center py-8">Loading activities...</p>
      ) : (
        <ActivityFeed activities={data.activities} />
      )}
    </div>
  );
}

export default App;