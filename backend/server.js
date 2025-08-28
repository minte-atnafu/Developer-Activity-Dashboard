const { ApolloServer, gql } = require('apollo-server');
const axios = require('axios');
const NodeCache = require('node-cache');

// Cache for API responses (5 minutes TTL)
const cache = new NodeCache({ stdTTL: 300 });

// GraphQL schema
const typeDefs = gql`
  type Activity {
    id: ID!
    type: String!
    source: String!
    title: String!
    description: String
    url: String
    timestamp: String!
    repoName: String
    tags: [String]
  }

  type Query {
    activities(
      source: String, 
      limit: Int, 
      offset: Int, 
      fromDate: String, 
      toDate: String
    ): [Activity]
  }
`;

// Resolvers define the technique for fetching the types defined in the schema
const resolvers = {
  Query: {
    activities: async (_, { source, limit = 20, offset = 0, fromDate, toDate }) => {
      try {
        console.log('Fetching activities with params:', { source, limit, offset, fromDate, toDate });
        
        // Fetch data from both sources
        const [githubData, stackoverflowData] = await Promise.allSettled([
          fetchGitHubActivity(),
          fetchStackOverflowActivity()
        ]);

        console.log('GitHub data status:', githubData.status);
        console.log('StackOverflow data status:', stackoverflowData.status);

        // Combine and normalize data
        let allActivities = [];
        
        if (githubData.status === 'fulfilled') {
          allActivities = allActivities.concat(githubData.value);
        } else {
          console.error('GitHub API error:', githubData.reason);
        }
        
        if (stackoverflowData.status === 'fulfilled') {
          allActivities = allActivities.concat(stackoverflowData.value);
        } else {
          console.error('StackOverflow API error:', stackoverflowData.reason);
        }

        console.log('Total activities before filtering:', allActivities.length);

        // Apply filters
        if (source) {
          allActivities = allActivities.filter(activity => activity.source === source);
          console.log('Activities after source filter:', allActivities.length);
        }

        // Apply date filters if provided
        if (fromDate) {
          const from = new Date(fromDate);
          allActivities = allActivities.filter(activity => new Date(activity.timestamp) >= from);
          console.log('Activities after fromDate filter:', allActivities.length);
        }

        if (toDate) {
          const to = new Date(toDate);
          allActivities = allActivities.filter(activity => new Date(activity.timestamp) <= to);
          console.log('Activities after toDate filter:', allActivities.length);
        }

        // Sort by timestamp (newest first)
        allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        const result = allActivities.slice(offset, offset + limit);
        console.log('Final result count:', result.length);
        
        return result;
      } catch (error) {
        console.error('Error in activities resolver:', error);
        throw new Error('Failed to fetch activities: ' + error.message);
      }
    },
  },
};

// GitHub API integration
async function fetchGitHubActivity() {
  const cacheKey = 'github_activity';
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log('Returning cached GitHub data');
    return cachedData;
  }

  try {
    // Use environment variable or fallback
    const username = process.env.GITHUB_USERNAME || 'torvalds'; // Default to Linus Torvalds for testing
    const token = process.env.GITHUB_TOKEN || '';
    
    console.log('Fetching GitHub activity for user:', username);
    
    const config = {
      headers: {
        'User-Agent': 'Developer-Activity-Dashboard'
      }
    };
    
    // Add authorization header if token is provided
    if (token) {
      config.headers.Authorization = `token ${token}`;
    }
    
    const response = await axios.get(`https://api.github.com/users/${username}/events`, config);
    console.log('GitHub API response status:', response.status);

    const activities = response.data.map(event => {
      let activity = {
        id: event.id,
        source: 'github',
        timestamp: event.created_at,
        url: `https://github.com/${event.repo.name}`
      };

      switch (event.type) {
        case 'PushEvent':
          activity.type = 'commit';
          activity.title = `Pushed ${event.payload.size} commit(s) to ${event.repo.name}`;
          activity.repoName = event.repo.name;
          break;
        case 'CreateEvent':
          activity.type = 'create';
          activity.title = `Created ${event.payload.ref_type} in ${event.repo.name}`;
          activity.repoName = event.repo.name;
          break;
        case 'IssuesEvent':
          activity.type = 'issue';
          activity.title = `${event.payload.action} issue in ${event.repo.name}`;
          activity.repoName = event.repo.name;
          break;
        case 'PullRequestEvent':
          activity.type = 'pull_request';
          activity.title = `${event.payload.action} pull request in ${event.repo.name}`;
          activity.repoName = event.repo.name;
          break;
        default:
          activity.type = event.type;
          activity.title = `GitHub activity: ${event.type} in ${event.repo.name}`;
          activity.repoName = event.repo.name;
      }

      return activity;
    });

    cache.set(cacheKey, activities);
    console.log('Fetched', activities.length, 'GitHub activities');
    return activities;
  } catch (error) {
    console.error('GitHub API error:', error.message);
    if (error.response) {
      console.error('GitHub API response status:', error.response.status);
      console.error('GitHub API response data:', error.response.data);
    }
    return [];
  }
}

// StackOverflow API integration
async function fetchStackOverflowActivity() {
  const cacheKey = 'stackoverflow_activity';
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    console.log('Returning cached StackOverflow data');
    return cachedData;
  }

  try {
    // Use a default user ID for testing
    const userId = process.env.STACKOVERFLOW_USER_ID || '22656'; // Default to Jon Skeet's ID for testing
    
    console.log('Fetching StackOverflow activity for user ID:', userId);
    
    const response = await axios.get(
      `https://api.stackexchange.com/2.3/users/${userId}/activity?site=stackoverflow`
    );
    
    console.log('StackOverflow API response status:', response.status);

    const activities = response.data.items.map(item => {
      const activity = {
        id: item.post_id || item.question_id || `so-${Date.now()}-${Math.random()}`,
        source: 'stackoverflow',
        timestamp: new Date((item.creation_date || item.last_activity_date) * 1000).toISOString(),
        type: item.post_type || 'activity'
      };

      if (item.post_type === 'answer') {
        activity.type = 'answer';
        activity.title = `Answered: ${item.title}`;
        activity.url = item.link;
      } else if (item.post_type === 'question') {
        activity.type = 'question';
        activity.title = `Asked: ${item.title}`;
        activity.url = item.link;
      } else {
        activity.type = 'activity';
        activity.title = `StackOverflow activity: ${item.activity_type}`;
      }

      if (item.tags) {
        activity.tags = item.tags;
      }

      return activity;
    });

    cache.set(cacheKey, activities);
    console.log('Fetched', activities.length, 'StackOverflow activities');
    return activities;
  } catch (error) {
    console.error('StackOverflow API error:', error.message);
    if (error.response) {
      console.error('StackOverflow API response status:', error.response.status);
      console.error('StackOverflow API response data:', error.response.data);
    }
    return [];
  }
}

// Create the Apollo Server with CORS enabled
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true,
  cors: {
    origin: ['http://localhost:3000', 'https://studio.apollographql.com'], // Allow React app and Apollo Studio
    credentials: true,
  },
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return error;
  },
});

// Start the server
server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
  console.log(`📋 Playground available at ${url}graphql`);
}).catch(error => {
  console.error('Failed to start server:', error);
});