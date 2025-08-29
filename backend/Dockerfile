# backend/Dockerfile
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install --only=production

# Copy all backend code
COPY . .

# Expose Apollo default port
EXPOSE 4000

# Start the app (CHANGE server.js if your file name differs)
CMD ["node", "server.js"]
