FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

RUN npm install -g @mariozechner/pi-coding-agent

# Bake in Ollama provider config so no external setup is needed
RUN mkdir -p /root/.pi/agent
COPY pi-models.json /root/.pi/agent/models.json

CMD ["sh"]