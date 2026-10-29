FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . /app
RUN mkdir -p /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8787 LICENSE_DATA_DIR=/data
EXPOSE 8787
CMD ["node", "server.cjs"]
