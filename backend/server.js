const { ApolloServer, gql } = require('apollo-server');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config(); // <-- load .env variables

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

// Resolvers
const resolvers = {
  Query: {
    activities: async (_, { source, limit = 20, offset = 0, fromDate, toDate }) => {
      try {
        console.log('Fetching activities with params:', { source, limit, offset, fromDate, toDate });
        
        const [githubData, stackoverflowData] = await Promise.allSettled([
          fetchGitHubActivity(),
          fetchStackOverflowActivity()
        ]);

        let allActivities = [];

        if (githubData.status === 'fulfilled') allActivities = allActivities.concat(githubData.value);
        if (stackoverflowData.status === 'fulfilled') allActivities = allActivities.concat(stackoverflowData.value);

        if (source) allActivities = allActivities.filter(a => a.source === source);
        if (fromDate) allActivities = allActivities.filter(a => new Date(a.timestamp) >= new Date(fromDate));
        if (toDate) allActivities = allActivities.filter(a => new Date(a.timestamp) <= new Date(toDate));

        allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return allActivities.slice(offset, offset + limit);
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
  if (cachedData) return cachedData;

  try {
    const username = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;

    if (!username || !token) throw new Error('GITHUB_USERNAME or GITHUB_TOKEN not set in .env');

    const config = {
      headers: {
        'User-Agent': 'Developer-Activity-Dashboard',
        'Authorization': `Bearer ${token}` // use Bearer token
      }
    };

    const response = await axios.get(`https://api.github.com/users/${username}/events`, config);

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
    return activities;
  } catch (error) {
    console.error('GitHub API error:', error.message);
    return [];
  }
}

// StackOverflow API integration
async function fetchStackOverflowActivity() {
  const cacheKey = 'stackoverflow_activity';
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  try {
    const userId = process.env.STACKOVERFLOW_USER_ID;
    if (!userId) throw new Error('STACKOVERFLOW_USER_ID not set in .env');

    const [questionsRes, answersRes] = await Promise.all([
      axios.get(`https://api.stackexchange.com/2.3/users/${userId}/questions?order=desc&sort=creation&site=stackoverflow`),
      axios.get(`https://api.stackexchange.com/2.3/users/${userId}/answers?order=desc&sort=creation&site=stackoverflow`)
    ]);

    const activities = [];

    questionsRes.data.items.forEach(q => {
      activities.push({
        id: `q-${q.question_id}`,
        source: 'stackoverflow',
        type: 'question',
        title: `Asked: ${q.title}`,
        url: q.link,
        timestamp: new Date(q.creation_date * 1000).toISOString(),
        tags: q.tags
      });
    });

    answersRes.data.items.forEach(a => {
      activities.push({
        id: `a-${a.answer_id}`,
        source: 'stackoverflow',
        type: 'answer',
        title: `Answered question ID: ${a.question_id}`,
        url: a.link,
        timestamp: new Date(a.creation_date * 1000).toISOString(),
      });
    });

    cache.set(cacheKey, activities);
    return activities;
  } catch (err) {
    console.error('StackOverflow API error:', err.message);
    return [];
  }
}

// Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true,
  cors: {
    origin: ['http://localhost:3000', 'https://studio.apollographql.com'],
    credentials: true,
  },
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return error;
  },
});

// Start server
server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
  console.log(`📋 Playground available at ${url}graphql`);
}).catch(error => {
  console.error('Failed to start server:', error);
});
