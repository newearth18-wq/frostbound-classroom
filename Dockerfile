FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate && pnpm install --frozen-lockfile --prod
COPY server ./server
COPY public ./public
USER node
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server/index.js"]
