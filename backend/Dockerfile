# Use Node.js 18 base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create directory for SQLite database if it doesn't exist
RUN mkdir -p /app/data

# Expose the server port
EXPOSE 5001

# Command to run the application
CMD ["npm", "start"]
