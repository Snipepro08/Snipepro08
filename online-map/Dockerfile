# --- Étape 1 : génération de la carte avec Python ---
FROM python:3.12-slim AS mapgen
WORKDIR /app
COPY map-generator/ ./map-generator/
COPY public/ ./public/
RUN python3 map-generator/generate_map.py --seed 42

# --- Étape 2 : serveur Node.js ---
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server/ ./server/
COPY --from=mapgen /app/public ./public

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
