FROM node:20-alpine AS builder
WORKDIR /app

# 复制 package 文件并安装所有依赖（包括开发依赖）
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:1.27-alpine

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 复制 nginx 配置
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
