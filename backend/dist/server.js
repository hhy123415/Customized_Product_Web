"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("./auth");
const dataAccess_1 = require("./dataAccess");
dotenv_1.default.config();
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;
const ENTERPRISE_REGISTER_CODE = process.env.ENTERPRISE_REGISTER_CODE || "6666";
const ADMIN_REGISTER_CODE = process.env.ADMIN_REGISTER_CODE || "8888";
dataAccess_1.db
    .checkConnection()
    .then(() => {
    console.log("数据库连接成功");
})
    .catch((err) => console.error("数据库连接失败:", err));
const app = (0, express_1.default)();
app.set("trust proxy", 1);
app.use((0, cookie_parser_1.default)());
const allowedOrigins = ["http://localhost:3000"];
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express_1.default.json());
const UPLOAD_DIR = path_1.default.resolve(process.cwd(), "uploads");
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const imageStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});
const uploadImage = (0, multer_1.default)({
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("Only image files are allowed"));
    },
});
app.use("/uploads", express_1.default.static(UPLOAD_DIR));
const SECRET_KEY = process.env.JWT_SECRET || "";
app.get("/api/me", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    try {
        const user = await dataAccess_1.db.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.json({
            success: true,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role,
                img_path: user.img_path || null,
            },
        });
    }
    catch (err) {
        console.error("me error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.get("/api/my_info", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    try {
        const user = await dataAccess_1.db.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "用户不存在",
            });
        }
        res.json({
            success: true,
            user: {
                username: req.user?.username,
                role: req.user?.role,
                email: user.email,
                img_path: user.img_path || null,
            },
        });
    }
    catch (err) {
        console.error("my_info 错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
app.put("/api/my_info/avatar", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    const { img_path } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    if (img_path !== null && typeof img_path !== "string") {
        return res.status(400).json({
            success: false,
            message: "img_path must be string or null",
        });
    }
    if (typeof img_path === "string" && !img_path.startsWith("/uploads/")) {
        return res.status(400).json({
            success: false,
            message: "img_path must be under /uploads/",
        });
    }
    try {
        const updatedUser = await dataAccess_1.db.updateUserImagePathById(userId, img_path ?? null);
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.json({
            success: true,
            message: "Avatar updated successfully",
            user: {
                username: updatedUser.username,
                role: updatedUser.role,
                email: updatedUser.email,
                img_path: updatedUser.img_path || null,
            },
        });
    }
    catch (err) {
        console.error("update avatar error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
        const userExists = await dataAccess_1.db.getUserByUsername(username);
        if (userExists) {
            return res.status(409).json({
                success: false,
                message: "用户名已存在",
            });
        }
        const emailExists = await dataAccess_1.db.getUserByEmail(email);
        if (emailExists) {
            return res.status(409).json({
                success: false,
                message: "邮箱已存在",
            });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
        if (role === "enterprise" && registerCode !== ENTERPRISE_REGISTER_CODE) {
            return res.status(403).json({
                success: false,
                message: "企业注册码错误",
            });
        }
        if (role === "admin" && registerCode !== ADMIN_REGISTER_CODE) {
            return res.status(403).json({
                success: false,
                message: "管理员注册码错误",
            });
        }
        await dataAccess_1.db.createUser({
            username,
            passwordHash: hashedPassword,
            email,
            role,
        });
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
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await dataAccess_1.db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "用户名或密码错误",
            });
        }
        const validPassword = await bcrypt_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "用户名或密码错误",
            });
        }
        const token = jsonwebtoken_1.default.sign({
            user_id: user.user_id,
            username: user.username,
            role: user.role,
        }, SECRET_KEY, { expiresIn: "24h" });
        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
            path: "/",
        });
        res.json({
            success: true,
            message: "登录成功",
            user_id: user.user_id,
            user_name: user.username,
            role: user.role,
            img_path: user.img_path || null,
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
app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true, message: "退出成功" });
});
app.post("/api/forget1", async (req, res) => {
    const { username, email } = req.body;
    try {
        const user = await dataAccess_1.db.getUserByUsernameAndEmail(username, email);
        if (!user) {
            return res.json({
                success: false,
                message: "用户名或邮箱错误",
            });
        }
        res.json({
            success: true,
            message: "用户名和邮箱匹配成功",
        });
    }
    catch (err) {
        console.error("forget1 错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
app.post("/api/forget2", async (req, res) => {
    const { username, newPassword } = req.body;
    if (String(newPassword).length < 6) {
        return res.status(409).json({ success: false, message: "密码长度至少6位" });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt_1.default.hash(newPassword, saltRounds);
    try {
        const updatedUser = await dataAccess_1.db.updateUserPasswordByUsername(username, hashedPassword);
        if (!updatedUser) {
            return res.json({
                success: false,
                message: "用户名未找到",
            });
        }
        res.json({
            success: true,
            message: "密码修改成功",
        });
    }
    catch (err) {
        console.error("forget2 错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
app.get("/api/posts", auth_1.authenticateToken, async (req, res) => {
    try {
        const posts = await dataAccess_1.db.getPostsWithAuthor();
        res.json({
            success: true,
            posts,
        });
    }
    catch (err) {
        console.error("posts 错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
app.post("/api/posts", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    const { title, content } = req.body;
    const trimmedTitle = (title || "").trim();
    const trimmedContent = (content || "").trim();
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    if (!trimmedTitle || !trimmedContent) {
        return res.status(400).json({
            success: false,
            message: "title and content are required",
        });
    }
    if (trimmedTitle.length > 255) {
        return res.status(400).json({
            success: false,
            message: "title is too long (max 255)",
        });
    }
    try {
        const post = await dataAccess_1.db.createPost({
            userId,
            title: trimmedTitle,
            content: trimmedContent,
        });
        return res.status(201).json({
            success: true,
            message: "Post created",
            post,
        });
    }
    catch (err) {
        console.error("create post error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.get("/api/posts/:postId", auth_1.authenticateToken, async (req, res) => {
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
    if (!postId) {
        return res.status(400).json({
            success: false,
            message: "postId is required",
        });
    }
    try {
        const post = await dataAccess_1.db.getPostDetailById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found",
            });
        }
        const comments = await dataAccess_1.db.getCommentsByPostId(postId);
        return res.json({
            success: true,
            post,
            comments,
        });
    }
    catch (err) {
        console.error("get post detail error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.post("/api/posts/:postId/comments", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
    const { content } = req.body;
    const trimmedContent = (content || "").trim();
    if (!postId) {
        return res.status(400).json({
            success: false,
            message: "postId is required",
        });
    }
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    if (!trimmedContent) {
        return res.status(400).json({
            success: false,
            message: "content is required",
        });
    }
    try {
        const post = await dataAccess_1.db.getPostDetailById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found",
            });
        }
        const comment = await dataAccess_1.db.createComment({
            postId,
            userId,
            content: trimmedContent,
        });
        return res.status(201).json({
            success: true,
            message: "Comment created",
            comment,
        });
    }
    catch (err) {
        console.error("create comment error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.post("/api/images/upload", auth_1.authenticateToken, uploadImage.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No image file uploaded",
        });
    }
    const relativePath = `/uploads/${req.file.filename}`;
    const imageUrl = `${req.protocol}://${req.get("host")}${relativePath}`;
    res.status(201).json({
        success: true,
        message: "Image uploaded successfully",
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: relativePath,
        url: imageUrl,
    });
});
app.use((err, _req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        return res.status(400).json({
            success: false,
            message: err.code === "LIMIT_FILE_SIZE"
                ? "Image size cannot exceed 5MB"
                : "Upload failed",
        });
    }
    if (err.message === "Only image files are allowed") {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    next(err);
});
app.post("/api/chat", auth_1.authenticateToken, async (req, res) => {
    try {
        if (!DIFY_API_URL || !DIFY_API_KEY) {
            return res.status(500).json({
                error: "Dify is not configured. Please set DIFY_API_URL and DIFY_API_KEY.",
            });
        }
        const { message, conversation_id } = req.body;
        const userId = req.user?.user_id;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const response = await axios_1.default.post(`${DIFY_API_URL}/chat-messages`, {
            inputs: {},
            query: message,
            response_mode: "streaming",
            user: userId || "default_user",
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
        response.data.pipe(res);
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
