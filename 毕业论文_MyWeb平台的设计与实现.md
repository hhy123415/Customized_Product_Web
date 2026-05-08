# MyWeb 平台的设计与实现

## 摘要

MyWeb 是一个集成了用户认证、社区论坛、产品定制下单、AI 智能客服与 Live2D 数字人交互的综合型 Web 平台。本平台采用前后端分离架构，前端基于 React 19 + TypeScript + Vite 构建，后端基于 Node.js + Express + TypeScript 实现，数据库采用 PostgreSQL 16，并集成了 Dify AI 平台提供的智能对话能力与 Live2D 数字人渲染引擎。系统通过 Docker Compose 实现一键部署，支持多角色权限管理、积分锁定内容、积分兑换等丰富的业务功能。

---

## 第一章 绪论

### 1.1 项目背景

随着电子商务与社区化运营模式的深度融合，用户对个性化产品定制和互动体验的需求日益增长。传统电商平台往往将交易与社区隔离，用户缺乏在产品定制过程中的交流与分享渠道。MyWeb 平台旨在将产品定制服务、创意社区交流、AI 智能客服与数字人交互整合于一体，为用户提供一站式的产品定制与社区体验。

### 1.2 项目目标

本项目的主要目标包括：

1. 构建一个支持多角色（普通用户、企业用户、管理员）的完整账号体系
2. 实现碳纤维台球杆与划船桨的在线定制与下单流程
3. 搭建创意社区，支持 Markdown 格式的帖子发布、评论以及灵活的访问控制
4. 集成 AI 智能客服，配合 Live2D 数字人实现自然的人机交互
5. 设计积分体系与签到激励，支持积分兑换实物奖品
6. 提供管理员后台，实现用户管理、订单管理与积分调整

---

## 第二章 系统架构与技术选型

### 2.1 整体架构

系统采用 B/S 架构，三层分离设计：

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| 前端层 | React 19 + TypeScript + Vite 7 + PixiJS 8 | SPA 应用，Live2D 渲染 |
| 后端层 | Node.js + Express 5 + TypeScript | RESTful API 服务 |
| 数据层 | PostgreSQL 16 | 关系型数据库 |
| AI 层 | Dify 平台 API | LLM 对话与知识库检索 |
| 基础设施 | Docker + Docker Compose + Nginx | 容器化部署 |

### 2.2 前端技术选型

- **React 19** — 利用最新的 React 特性构建 UI
- **TypeScript** — 全量类型安全，前端 Interface 与后端接口对齐
- **Vite 7** — 开发构建工具，支持 HMR 热更新与反向代理
- **React Router 7** — 客户端路由，支持嵌套路由与权限守卫
- **PixiJS 8 + easy-live2d** — WebGL 2D 渲染引擎，驱动 Live2D 数字人模型
- **react-markdown + remark-gfm + rehype-katex** — Markdown 渲染与数学公式支持
- **Lucide React** — 图标库
- **CSS Modules** — 组件级样式隔离

### 2.3 后端技术选型

- **Express 5** — 轻量级 Web 框架
- **TypeScript** — 类型安全的后端开发
- **pg（node-postgres）** — PostgreSQL 数据库驱动，含连接池管理与事务支持
- **bcrypt** — 密码哈希加密
- **jsonwebtoken** — JWT 令牌签发与验证
- **multer** — 文件上传中间件
- **nodemailer** — SMTP 邮件发送（验证码）
- **cookie-parser + cors** — Cookie 解析与跨域处理
- **axios** — 向 Dify API 发起流式请求

### 2.4 数据库设计

数据库部署于 PostgreSQL 16，核心表结构如下：

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | user_id, username, password_hash, email, role, points, img_path, bio, is_certified_designer |
| `user_works` | 用户作品表 | work_id, user_id, image_path, description |
| `posts` | 论坛帖子表 | post_id, user_id, title, content, access_level, points_required, preview_length |
| `comments` | 评论表 | comment_id, post_id, user_id, content |
| `orders` | 定制订单表 | order_id, user_id, product_name, configuration(JSONB), pricing_lines(JSONB), status, contact_* |
| `email_verification_codes` | 邮箱验证码表 | email, code, expires_at, used |
| `user_check_ins` | 签到记录表 | user_id, check_in_date, streak_count, total_points |
| `point_records` | 积分流水表 | user_id, points_change, points_after, detail |
| `redemptions` | 积分兑换表 | user_id, reward_id, points_deducted, status |
| `user_post_unlocks` | 帖子解锁记录表 | user_id, post_id, points_spent |

数据库设计中运用了 **触发器（Trigger）** 来自动维护 `updated_at` 时间戳、`reply_count` 评论计数、以及 `point_records → users.points` 的积分同步，保证了数据一致性的同时减轻了应用层负担。

---

## 第三章 功能模块设计

### 3.1 用户认证与权限管理

系统支持三种角色：**regular（普通用户）**、**enterprise（企业用户）**、**admin（管理员）**。

认证流程基于 JWT：

1. 用户登录时，后端验证 bcrypt 哈希密码
2. 验证通过后签发 JWT Token，写入 httpOnly Cookie（24 小时有效期）
3. 后续请求通过 `authenticateToken` 中间件验证 Cookie 中的 Token
4. 管理员接口额外经过 `authenticateAdmin` 中间件校验角色

注册流程包含邮箱验证码机制：

1. 用户填写注册信息后，系统调用 nodemailer 发送 6 位数字验证码至邮箱
2. 验证码有效期 10 分钟，每 10 分钟最多发送 3 次
3. 管理员注册需额外验证管理注册码（`ADMIN_REGISTER_CODE`）
4. 验证码使用后自动标记为已使用，防止重复利用

密码找回采用两步验证：先校验用户名与邮箱匹配，再重置密码（最小长度 6 位）。

### 3.2 产品定制与订单管理

系统支持两类产品的在线定制：

**碳纤维台球杆定制** — 支持预设模式与自由定制模式：

- 预设模式中，用户可配置：长度（基准 147cm）、重量（基准 19oz）、接牙类型（不锈钢/钛合金）、握把类型（碳纤维/真皮/无）、涂装风格（磨砂碳纹/光泽碳纤/隐形黑/冰银色/海洋蓝/绯红色）、球杆盒（无/基础/专业）
- 系统自动根据定价规则计算总价，后端 `calculatePoolCuePrice()` 函数按阶梯定价模型实时计算
- 长度每偏离标准 1cm 增减 26 元，重量每偏离 1oz 增减 80 元，钛合金接牙 +320 元，真皮握把 +280 元，特殊涂装 +260 元，专业硬盒 +460 元

**碳纤维划船桨定制** — 同样支持预设与自由两种模式：

- 预设模式下可配置桨长（基准 220cm）、杆身弹性（标准/高响应）、表面处理（原碳/定制涂装）

订单状态流转模型：`submitted → quoted → processing → shipped → completed`，任一环节可流转至 `cancelled`。自由定制订单由管理员通过估价接口（`/api/admin/orders/:orderId/estimate`）报价后，用户可以选择接受或拒绝。

### 3.3 创意社区论坛

社区模块支持 Markdown 格式的帖子发布与评论系统：

- **帖子发布**：支持 Markdown 内容编写，标题最长 255 字符
- **三层访问控制**：
  - `public`：任何人可查看
  - `owner_admin`：仅帖主和管理员可查看完整内容
  - `points`：需消耗积分解锁，解锁前仅展示预览内容（默认 150 字符）
- **积分解锁**：用户消耗积分解锁后，`user_post_unlocks` 表记录解锁关系，后续无需重复消费
- **评论系统**：通过数据库触发器自动维护帖子的回复计数

### 3.4 AI 智能客服与 Live2D 数字人

系统集成了两个特色交互模块：

**AI 智能客服**：
- 通过 Dify 平台 API (`/v1/chat-messages`) 提供流式对话
- Dify Prompt 预设将 AI 角色定位为"MyWeb 平台 AI 客服"
- 知识库包含平台功能导航、定价规则、使用帮助等专属知识
- Dify 配置了严格的回答范围，仅限平台相关问题，拒绝回答无关内容
- 支持会话管理（`conversationId`），用户可开始新对话

**Live2D 数字人**：
- 用户登录后，页面显示 Live2D 数字人看板娘（使用 `easy-live2d` + `pixi.js` 渲染）
- 搭载两套 Live2D 模型资源：**hiyori_pro_zh**（日和）和 **mao_pro_zh**（猫）
- 数字人挂载 AI 聊天输入框，用户可直接与 AI 客服对话
- 支持显示/隐藏切换，聊天框可独立开关
- 回复内容经清洗处理（移除 `<think>` 标签、修复 Markdown 表格格式），以 Markdown 渲染

### 3.5 积分体系

- **签到机制**：用户每日可签到一次，基础积分 5 分，连续签到奖励每叠加一天 +2 分（最多 7 天），最长连续签到时单日可获得 5 + 14 = 19 分
- **积分流水**：`point_records` 表完整记录每次积分变动，通过触发器自动同步 `users.points`
- **积分兑换**：支持配置化奖品（`REWARDS_CONFIG` 环境变量），用户消耗积分兑换实物，需填写收货信息
- **管理员调分**：管理员可通过后台手动调整用户积分，操作完整记录审计

### 3.6 管理员后台

管理员专属功能包括：
- **用户查询**：按关键词搜索用户，查看用户名、邮箱、角色、积分、设计师认证等信息
- **用户管理**：调整用户积分、切换设计师认证状态
- **订单查询**：按关键词搜索所有用户的订单
- **订单管理**：更新订单状态（submitted/quoted/processing/shipped/completed/cancelled）
- **自由定制估价**：对自由定制订单进行人工估价，填写估价明细与备注

---

## 第四章 部署与运维

### 4.1 Docker Compose 编排

系统通过 `docker-compose.yml` 定义三个核心服务：

| 服务 | 容器名 | 端口 | 依赖 |
|------|--------|------|------|
| PostgreSQL 16 | `myweb-postgres` | 5432 | — |
| Backend (Express) | `myweb-backend` | 3001 | postgres (健康检查) |
| Frontend (Nginx) | `myweb-frontend` | 3000 → 80 | backend |

PostgreSQL 容器启动时自动执行 `01_schema.sql` 完成数据库初始化。Backend 通过健康检查确保数据库就绪后才启动。Frontend 通过 Nginx 提供静态文件服务。

### 4.2 开发环境

- 前端 Vite 开发服务器运行在 `localhost:3000`，通过 proxy 将 `/api` 请求转发至 `localhost:3001`
- 后端 ts-node-dev 运行在 `localhost:3001`，支持热重载
- 启动命令：`bun run dev`（前端）/ `yarn dev`（后端）

---

## 第五章 总结与展望

### 5.1 项目成果

本项目成功实现了一个功能完整的产品定制与社区互动平台，涵盖用户认证、产品定制、订单管理、社区论坛、AI 客服、积分体系、管理员后台等七大核心模块。系统采用现代化的前后端分离架构，具备良好的可扩展性与可维护性。

### 5.2 技术亮点

1. **前后端类型同步**：前后端 TypeScript Interface 定义对齐，从编译期保证接口契约一致性
2. **数据库触发器驱动**：利用 PostgreSQL 触发器自动维护 `updated_at`、`reply_count`、积分同步，减少应用层代码复杂度
3. **多层访问控制**：帖子支持 public/owner_admin/points 三层访问控制，结合积分解锁与评论权限联动
4. **定价引擎**：后端实时计算定制产品价格，前端同步展示，支持预设与自由定制双模式
5. **AI + 数字人融合**：将 LLM 对话能力与 Live2D 渲染结合，提供富交互的用户体验
6. **容器化一键部署**：Docker Compose 编排三服务，PostgreSQL 初始化脚本自动化建表

### 5.3 未来展望

- 接入支付宝/微信支付，实现在线支付闭环
- 引入 Redis 缓存层，提升高并发场景下的性能
- 增加 WebSocket 实时通知（订单状态变更、新评论等）
- 拓展更多产品定制品类
- 引入 Elasticsearch 实现全文搜索
