# Använd officiella Node.js LTS-versionen som basbild
FROM node:18-slim

# Sätt arbetskatalogen i containern
WORKDIR /usr/src/app

# Kopiera package.json och package-lock.json (om sådan finns)
COPY package*.json ./

# Installera applikationens beroenden
RUN npm install --production

# Kopiera resten av applikationskoden
COPY . .

# Exponera den port som applikationen lyssnar på
EXPOSE 8080

# Definiera kommandot för att starta applikationen
CMD [ "node", "app.js" ]