function ActivityFeed({ activities }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIcon = (source, type) => {
    if (source === 'github') {
      switch (type) {
        case 'commit': return '📝';
        case 'create': return '🆕';
        case 'issue': return '🐛';
        case 'pull_request': return '🔀';
        default: return '📂';
      }
    } else {
      switch (type) {
        case 'answer': return '💡';
        case 'question': return '❓';
        default: return '📝';
      }
    }
  };

  if (activities.length === 0) {
    return <p className="text-center py-8">No activities found.</p>;
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-start">
            <span className="text-2xl mr-3">{getIcon(activity.source, activity.type)}</span>
            <div className="flex-1">
              <h3 className="font-semibold">{activity.title}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(activity.timestamp)} • {activity.source}
              </p>
              {activity.tags && activity.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activity.tags.map(tag => (
                    <span key={tag} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {activity.url && (
              <a 
                href={activity.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 ml-2"
              >
                View
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityFeed;