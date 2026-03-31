"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const bcrypt_1 = __importDefault(require("bcrypt"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("./auth");
const axios_1 = __importDefault(require("axios"));
dotenv_1.default.config();
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;
const ENTERPRISE_REGISTER_CODE = process.env.ENTERPRISE_REGISTER_CODE || "6666";
const ADMIN_REGISTER_CODE = process.env.ADMIN_REGISTER_CODE || "8888";
// 连接数据库配置
const pool = new pg_1.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || ""),
});
// 测试连接
pool
    .connect()
    .then((client) => {
    console.log("成功连接到数据库");
    client.release();
})
    .catch((err) => console.error("数据库连接失败:", err));
const app = (0, express_1.default)();
app.use((0, cookie_parser_1.default)());
//前端来源(localhost后续应改为服务器ip)
const allowedOrigins = ["http://localhost:3000"];
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express_1.default.json());
const SECRET_KEY = process.env.JWT_SECRET || "";
// --- 获取当前用户信息接口 (AuthProvider 初始化时调用),用于验证权限操作 ---
app.get("/api/me", auth_1.authenticateToken, async (req, res) => {
    res.json({
        success: true,
        user: {
            user_id: req.user?.user_id,
            username: req.user?.username,
            role: req.user?.role,
        },
    });
});
//---获取用户相关信息，用于用户中心显示---
app.get("/api/my_info", auth_1.authenticateToken, async (req, res) => {
    const user_id = req.user?.user_id;
    try {
        const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
        res.json({
            success: true,
            user: {
                username: req.user?.username,
                role: req.user?.role,
                email: result.rows[0].email,
            },
        });
    }
    catch (err) {
        console.error("my_info错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
// --- 注册接口 ---
app.post("/api/register", async (req, res) => {
    const { username, password, email, registerCode, role } = req.body;
    const allowedRoles = ["regular", "enterprise", "admin"];
    try {
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "用户类型无效",
            });
        }
        // 检查用户是否已存在 (使用泛型确保返回类型)
        const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "用户名已存在",
            });
        }
        // 检查邮箱是否已存在
        const emailExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (emailExists.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "邮箱已存在",
            });
        }
        //完善密码加密
        const saltRounds = 10;
        const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
        // 判断是否是企业用户（注册码后续可优化）
        if (role === "enterprise") {
            if (registerCode !== ENTERPRISE_REGISTER_CODE) {
                return res.status(403).json({
                    success: false,
                    message: "企业注册码错误",
                });
            }
        }
        if (role === "admin") {
            if (registerCode !== ADMIN_REGISTER_CODE) {
                return res.status(403).json({
                    success: false,
                    message: "管理员注册码错误",
                });
            }
        }
        // 插入新用户 (存储加密后的密码)
        await pool.query("INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)", [username, hashedPassword, email, role]);
        res.status(201).json({
            success: true,
            message: "注册成功",
        });
    }
    catch (err) {
        console.error("注册错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
// --- 登录接口 ---
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        // 查询用户
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "用户名或密码错误",
            });
        }
        const user = result.rows[0];
        // 验证密码（比较哈希值）
        const validPassword = await bcrypt_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "用户名或密码错误",
            });
        }
        // 登录成功,生成token
        const token = jsonwebtoken_1.default.sign({
            user_id: user.user_id,
            username: user.username,
            role: user.role,
        }, SECRET_KEY, { expiresIn: "24h" });
        // 设置 HTTP-Only Cookie
        res.cookie("token", token, {
            httpOnly: true, // 防止 JavaScript 读取，防 XSS
            secure: false, // 允许http,true时仅允许https
            sameSite: "lax", // 防止 CSRF
            maxAge: 24 * 60 * 60 * 1000, // 与 JWT 有效期一致
            path: "/", // 确保 cookie 在所有路径下可用
        });
        // 返回用户信息给前端（不含 Token）
        res.json({
            success: true,
            message: "登录成功",
            user_id: user.user_id,
            user_name: user.username,
            role: user.role,
        });
    }
    catch (err) {
        console.error("登录错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
// --- 登出接口 ---
app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true, message: "登出成功" });
});
//---重置密码时，验证用户名和邮箱是否存在---
app.post("/api/forget1", async (req, res) => {
    const { username, email } = req.body;
    try {
        // 查询用户
        const result = await pool.query("SELECT * FROM users WHERE username = $1 and email = $2", [username, email]);
        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "用户名或邮箱错误",
            });
        }
        // 返回用户信息给前端（不含 Token）
        res.json({
            success: true,
            message: "用户名和邮箱匹配成功",
        });
    }
    catch (err) {
        console.error("forget1错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
//---重置密码时，修改对应密码---
app.post("/api/forget2", async (req, res) => {
    const { username, newPassword } = req.body;
    //后端再次验证密码长度
    if (String(newPassword).length < 6) {
        return res.status(409).json({ success: false, message: "密码长度至少6位" });
    }
    //密码加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt_1.default.hash(newPassword, saltRounds);
    try {
        //更新语句
        const updateQuery = `UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING *;`;
        const result = await pool.query(updateQuery, [
            hashedPassword,
            username,
        ]);
        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "用户名未找到",
            });
        }
        // 返回用户信息给前端（不含 Token）
        res.json({
            success: true,
            message: "密码修改成功",
        });
    }
    catch (err) {
        console.error("forget2错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
//---获取帖子总览信息---
app.get("/api/posts", auth_1.authenticateToken, async (req, res) => {
    const user_id = req.user?.user_id; //与后续我的帖子功能相关
    try {
        const result = await pool.query(`
          SELECT 
            p.post_id,
            p.title,
            p.content,
            p.reply_count,
            p.created_at,
            p.updated_at,
            u.username AS author_username
          FROM posts p
          JOIN users u ON p.user_id = u.user_id
          ORDER BY p.created_at DESC
        `);
        res.json({
            success: true,
            posts: result.rows,
        });
    }
    catch (err) {
        console.error("posts错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
//---后端转发ai对话请求---
app.post("/api/chat", auth_1.authenticateToken, async (req, res) => {
    try {
        if (!DIFY_API_URL || !DIFY_API_KEY) {
            return res.status(500).json({
                error: "Dify is not configured. Please set DIFY_API_URL and DIFY_API_KEY.",
            });
        }
        const { message, conversation_id } = req.body;
        const user_id = req.user?.user_id;
        // 设置响应头，告知浏览器这是一个流
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const response = await axios_1.default.post(`${DIFY_API_URL}/chat-messages`, {
            inputs: {},
            query: message,
            response_mode: "streaming",
            user: user_id || "default_user",
            // 如果 conversation_id 为空，Dify 会创建新会话；如果不为空，则继续旧会话
            conversation_id: conversation_id || "",
        }, {
            headers: {
                Authorization: `Bearer ${DIFY_API_KEY}`,
                "Content-Type": "application/json",
            },
            responseType: "stream",
            validateStatus: () => true,
        });
        if (response.status < 200 || response.status >= 300) {
            let errorBody = "";
            response.data.on("data", (chunk) => {
                errorBody += chunk.toString("utf8");
            });
            response.data.on("end", () => {
                res.status(response.status).json({
                    error: "Dify upstream error",
                    details: errorBody || "Empty upstream error response",
                });
            });
            return;
        }
        // 将 Dify 的流管道直接连接到 res
        response.data.pipe(res);
        // 当 Dify 流结束时，确保 res 也关闭
        response.data.on("end", () => {
            res.end();
        });
    }
    catch (error) {
        console.error("Dify logic error:", error);
        res.status(500).json({
            error: "Dify logic error",
            details: error instanceof Error ? error.message : "Unknown backend error",
        });
        res.end();
    }
});
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
