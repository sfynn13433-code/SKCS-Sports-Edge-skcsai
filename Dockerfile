# Use a lightweight Node.js LTS image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install only production dependencies
RUN npm ci --only=production && npm --prefix backend ci --only=production

# Copy the rest of the SKCS AI Sports Edge codebase
COPY . .

# Cloud Run injects the PORT environment variable (defaults to 8080)
# Ensure your Express server listens to process.env.PORT!
ENV PORT=8080
EXPOSE 8080

# The command to start your pipeline server
# Adjust this if your main entry file is named differently
CMD [ "node", "backend/server.js" ]
