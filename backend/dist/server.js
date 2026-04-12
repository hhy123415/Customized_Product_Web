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
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const auth_1 = require("./auth");
const dataAccess_1 = require("./dataAccess");
dotenv_1.default.config();
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;
const DIFY_CHAT_TIMEOUT_MS = Number(process.env.DIFY_CHAT_TIMEOUT_MS || 45000);
const ENTERPRISE_REGISTER_CODE = process.env.ENTERPRISE_REGISTER_CODE || "6666";
const ADMIN_REGISTER_CODE = process.env.ADMIN_REGISTER_CODE || "8888";
// 邮件发送配置
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
// 验证码配置
const VERIFICATION_CODE_EXPIRY_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || "10", 10);
const MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES = parseInt(process.env.MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES || "3", 10);
// 创建邮件传输器
const createTransporter = () => {
    return nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
};
// 生成6位数字验证码
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
// 发送验证码邮件
const sendVerificationEmail = async (email, code) => {
    try {
        const transporter = createTransporter();
        const mailOptions = {
            from: EMAIL_FROM,
            to: email,
            subject: "邮箱验证码 - 您的网站",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">邮箱验证码</h2>
          <p style="color: #666; font-size: 16px;">您好！</p>
          <p style="color: #666; font-size: 16px;">您正在注册我们的网站，验证码为：</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #333; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="color: #666; font-size: 16px;">验证码有效期为 ${VERIFICATION_CODE_EXPIRY_MINUTES} 分钟，请尽快使用。</p>
          <p style="color: #666; font-size: 16px;">如果您没有进行此操作，请忽略此邮件。</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #999; font-size: 14px; text-align: center;">此邮件由系统自动发送，请勿回复。</p>
        </div>
      `,
        };
        await transporter.sendMail(mailOptions);
        return true;
    }
    catch (error) {
        console.error("发送验证码邮件失败:", error);
        return false;
    }
};
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
const MAX_BIO_LENGTH = 500;
const MAX_WORK_DESCRIPTION_LENGTH = 200;
const MAX_PRODUCT_NAME_LENGTH = 120;
const MAX_PRODUCT_SUMMARY_LENGTH = 1000;
const MAX_REVIEW_COMMENT_LENGTH = 500;
const MAX_PARAMETER_COUNT = 20;
const MAX_PARAMETER_NAME_LENGTH = 50;
const MAX_PARAMETER_OPTION_COUNT = 20;
const PRODUCT_PAGE_STATUS_VALUES = [
    "draft",
    "pending_review",
    "approved",
    "rejected",
];
const isEnterpriseUser = (req) => req.user?.role === "enterprise";
const normalizeProductPageParameters = (input) => {
    if (!Array.isArray(input)) {
        throw new Error("parameters must be an array");
    }
    if (input.length > MAX_PARAMETER_COUNT) {
        throw new Error(`parameters cannot exceed ${MAX_PARAMETER_COUNT}`);
    }
    return input.map((item, index) => {
        if (!item || typeof item !== "object") {
            throw new Error(`parameter ${index + 1} is invalid`);
        }
        const raw = item;
        const name = String(raw.name || "").trim();
        const type = String(raw.type || "").trim();
        const required = Boolean(raw.required);
        const unit = String(raw.unit || "").trim();
        const defaultValue = String(raw.default_value || raw.defaultValue || "").trim();
        const optionsInput = Array.isArray(raw.options) ? raw.options : [];
        if (!name) {
            throw new Error(`parameter ${index + 1} name is required`);
        }
        if (name.length > MAX_PARAMETER_NAME_LENGTH) {
            throw new Error(`parameter ${index + 1} name is too long`);
        }
        if (!["text", "number", "select"].includes(type)) {
            throw new Error(`parameter ${index + 1} type is invalid`);
        }
        const options = type === "select"
            ? optionsInput
                .map((option) => String(option || "").trim())
                .filter(Boolean)
                .slice(0, MAX_PARAMETER_OPTION_COUNT)
            : [];
        if (type === "select" && options.length === 0) {
            throw new Error(`parameter ${index + 1} requires at least one option`);
        }
        return {
            id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : (0, crypto_1.randomUUID)(),
            name,
            type: type,
            required,
            unit: unit || null,
            default_value: defaultValue || null,
            options,
        };
    });
};
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
app.get("/api/admin/users", auth_1.authenticateToken, auth_1.authenticateAdmin, async (req, res) => {
    const rawKeyword = req.query.keyword;
    const keyword = typeof rawKeyword === "string"
        ? rawKeyword.trim().slice(0, 100)
        : Array.isArray(rawKeyword)
            ? String(rawKeyword[0] ?? "").trim().slice(0, 100)
            : "";
    try {
        const users = await dataAccess_1.db.getUsersForAdmin(keyword, 100);
        return res.json({
            success: true,
            users,
        });
    }
    catch (err) {
        console.error("admin users query error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.get("/api/enterprise/product-pages", auth_1.authenticateToken, async (req, res) => {
    if (!isEnterpriseUser(req)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const userId = req.user?.user_id;
    const rawStatus = req.query.status;
    const status = typeof rawStatus === "string" && PRODUCT_PAGE_STATUS_VALUES.includes(rawStatus)
        ? rawStatus
        : undefined;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
        const pages = await dataAccess_1.db.getProductCustomizationPagesByUserId(userId, status);
        return res.json({ success: true, pages });
    }
    catch (err) {
        console.error("get enterprise product pages error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
app.get("/api/enterprise/product-pages/:pageId", auth_1.authenticateToken, async (req, res) => {
    if (!isEnterpriseUser(req)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const userId = req.user?.user_id;
    const pageId = Array.isArray(req.params.pageId) ? req.params.pageId[0] : req.params.pageId;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!pageId) {
        return res.status(400).json({ success: false, message: "pageId is required" });
    }
    try {
        const page = await dataAccess_1.db.getProductCustomizationPageById(pageId);
        if (!page || page.user_id !== userId) {
            return res.status(404).json({ success: false, message: "Page not found" });
        }
        return res.json({ success: true, page });
    }
    catch (err) {
        console.error("get enterprise product page detail error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
app.post("/api/enterprise/product-pages", auth_1.authenticateToken, async (req, res) => {
    if (!isEnterpriseUser(req)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const userId = req.user?.user_id;
    const { page_id, product_name, product_summary, parameters } = req.body;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const productName = (product_name || "").trim();
    const productSummary = (product_summary || "").trim();
    if (!productName) {
        return res.status(400).json({ success: false, message: "product_name is required" });
    }
    if (productName.length > MAX_PRODUCT_NAME_LENGTH) {
        return res.status(400).json({ success: false, message: "product_name is too long" });
    }
    if (productSummary.length > MAX_PRODUCT_SUMMARY_LENGTH) {
        return res.status(400).json({ success: false, message: "product_summary is too long" });
    }
    try {
        const normalizedParameters = normalizeProductPageParameters(parameters || []);
        const page = await dataAccess_1.db.saveProductCustomizationPage({
            pageId: typeof page_id === "string" && page_id.trim() ? page_id.trim() : undefined,
            userId,
            productName,
            productSummary: productSummary || null,
            parameters: normalizedParameters,
        });
        return res.status(201).json({ success: true, page });
    }
    catch (err) {
        console.error("save enterprise product page error:", err);
        return res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : "Invalid request",
        });
    }
});
app.post("/api/enterprise/product-pages/:pageId/submit", auth_1.authenticateToken, async (req, res) => {
    if (!isEnterpriseUser(req)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const userId = req.user?.user_id;
    const pageId = Array.isArray(req.params.pageId) ? req.params.pageId[0] : req.params.pageId;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!pageId) {
        return res.status(400).json({ success: false, message: "pageId is required" });
    }
    try {
        const existingPage = await dataAccess_1.db.getProductCustomizationPageById(pageId);
        if (!existingPage || existingPage.user_id !== userId) {
            return res.status(404).json({ success: false, message: "Page not found" });
        }
        if (existingPage.parameters.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one parameter is required before submit",
            });
        }
        const page = await dataAccess_1.db.submitProductCustomizationPage(pageId, userId);
        return res.json({ success: true, page });
    }
    catch (err) {
        console.error("submit enterprise product page error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
app.get("/api/admin/product-pages", auth_1.authenticateToken, auth_1.authenticateAdmin, async (req, res) => {
    const rawStatus = req.query.status;
    const status = typeof rawStatus === "string" && PRODUCT_PAGE_STATUS_VALUES.includes(rawStatus)
        ? rawStatus
        : undefined;
    try {
        const pages = await dataAccess_1.db.getProductCustomizationPagesForAdmin(status);
        return res.json({ success: true, pages });
    }
    catch (err) {
        console.error("get admin product pages error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
app.post("/api/admin/product-pages/:pageId/review", auth_1.authenticateToken, auth_1.authenticateAdmin, async (req, res) => {
    const reviewerId = req.user?.user_id;
    const pageId = Array.isArray(req.params.pageId) ? req.params.pageId[0] : req.params.pageId;
    const { action, review_comment } = req.body;
    if (!reviewerId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!pageId) {
        return res.status(400).json({ success: false, message: "pageId is required" });
    }
    const nextStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : null;
    if (!nextStatus) {
        return res.status(400).json({ success: false, message: "action must be approve or reject" });
    }
    const reviewComment = (review_comment || "").trim();
    if (reviewComment.length > MAX_REVIEW_COMMENT_LENGTH) {
        return res.status(400).json({ success: false, message: "review_comment is too long" });
    }
    try {
        const page = await dataAccess_1.db.reviewProductCustomizationPage({
            pageId,
            reviewerId,
            status: nextStatus,
            reviewComment: reviewComment || null,
        });
        if (!page) {
            return res.status(404).json({ success: false, message: "Page not found" });
        }
        return res.json({ success: true, page });
    }
    catch (err) {
        console.error("review product page error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
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
                user_id: user.user_id,
                username: req.user?.username,
                role: req.user?.role,
                email: user.email,
                img_path: user.img_path || null,
                bio: user.bio || "",
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
app.get("/api/users/:userId/profile", auth_1.authenticateToken, async (req, res) => {
    const rawUserId = req.params.userId;
    const targetUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const currentUserId = req.user?.user_id;
    if (!targetUserId) {
        return res.status(400).json({
            success: false,
            message: "userId is required",
        });
    }
    try {
        const user = await dataAccess_1.db.getUserPublicProfileById(targetUserId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const works = await dataAccess_1.db.getUserWorksByUserId(targetUserId);
        const isOwner = Boolean(currentUserId && currentUserId === targetUserId);
        return res.json({
            success: true,
            is_owner: isOwner,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role,
                img_path: user.img_path || null,
                bio: user.bio || "",
                created_at: user.created_at,
            },
            works,
        });
    }
    catch (err) {
        console.error("get user profile error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
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
app.put("/api/my_info/profile", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    const rawBio = req.body.bio;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    if (rawBio !== null && rawBio !== undefined && typeof rawBio !== "string") {
        return res.status(400).json({
            success: false,
            message: "bio must be string or null",
        });
    }
    const bio = (rawBio || "").trim();
    if (bio.length > MAX_BIO_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `bio is too long (max ${MAX_BIO_LENGTH})`,
        });
    }
    try {
        const updatedUser = await dataAccess_1.db.updateUserBioById(userId, bio || null);
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                user_id: updatedUser.user_id,
                username: updatedUser.username,
                role: updatedUser.role,
                email: updatedUser.email,
                img_path: updatedUser.img_path || null,
                bio: updatedUser.bio || "",
            },
        });
    }
    catch (err) {
        console.error("update profile error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.post("/api/my_info/works", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    const { image_path, description } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    const imagePath = (image_path || "").trim();
    if (!imagePath) {
        return res.status(400).json({
            success: false,
            message: "image_path is required",
        });
    }
    if (!imagePath.startsWith("/uploads/")) {
        return res.status(400).json({
            success: false,
            message: "image_path must be under /uploads/",
        });
    }
    if (description !== null && description !== undefined && typeof description !== "string") {
        return res.status(400).json({
            success: false,
            message: "description must be string or null",
        });
    }
    const normalizedDescription = (description || "").trim();
    if (normalizedDescription.length > MAX_WORK_DESCRIPTION_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `description is too long (max ${MAX_WORK_DESCRIPTION_LENGTH})`,
        });
    }
    try {
        const work = await dataAccess_1.db.createUserWork({
            userId,
            imagePath,
            description: normalizedDescription || null,
        });
        return res.status(201).json({
            success: true,
            message: "Work created",
            work,
        });
    }
    catch (err) {
        console.error("create user work error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
app.delete("/api/my_info/works/:workId", auth_1.authenticateToken, async (req, res) => {
    const userId = req.user?.user_id;
    const rawWorkId = req.params.workId;
    const workId = Array.isArray(rawWorkId) ? rawWorkId[0] : rawWorkId;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    if (!workId) {
        return res.status(400).json({
            success: false,
            message: "workId is required",
        });
    }
    try {
        const deleted = await dataAccess_1.db.deleteUserWorkByIdAndUserId(workId, userId);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Work not found",
            });
        }
        return res.json({
            success: true,
            message: "Work deleted",
            work: deleted,
        });
    }
    catch (err) {
        console.error("delete user work error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
// 发送邮箱验证码
app.post("/api/send-verification-code", async (req, res) => {
    const { email } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    try {
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "邮箱地址不能为空",
            });
        }
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "邮箱格式不正确",
            });
        }
        // 检查邮箱是否已被注册
        const emailExists = await dataAccess_1.db.getUserByEmail(email);
        if (emailExists) {
            return res.status(409).json({
                success: false,
                message: "该邮箱已被注册",
            });
        }
        // 检查最近10分钟内的验证码发送次数
        const recentAttempts = await dataAccess_1.db.getRecentVerificationAttempts(email);
        if (recentAttempts >= MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES) {
            return res.status(429).json({
                success: false,
                message: "验证码发送过于频繁，请稍后再试",
            });
        }
        // 生成验证码
        const code = generateVerificationCode();
        const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);
        // 保存验证码到数据库
        await dataAccess_1.db.createVerificationCode({
            email,
            code,
            expiresAt,
            ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
            userAgent,
        });
        // 发送验证码邮件
        const emailSent = await sendVerificationEmail(email, code);
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "验证码发送失败，请稍后重试",
            });
        }
        // 清理过期验证码
        await dataAccess_1.db.cleanupExpiredVerificationCodes();
        res.json({
            success: true,
            message: "验证码已发送到您的邮箱",
            expiresIn: VERIFICATION_CODE_EXPIRY_MINUTES * 60, // 返回秒数
        });
    }
    catch (err) {
        console.error("发送验证码错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
// 验证邮箱验证码
app.post("/api/verify-email-code", async (req, res) => {
    const { email, code } = req.body;
    try {
        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: "邮箱和验证码不能为空",
            });
        }
        // 获取有效的验证码
        const verificationCode = await dataAccess_1.db.getValidVerificationCode(email, code);
        if (!verificationCode) {
            return res.status(400).json({
                success: false,
                message: "验证码无效或已过期",
            });
        }
        // 标记验证码为已使用
        await dataAccess_1.db.markVerificationCodeAsUsed(verificationCode.id);
        res.json({
            success: true,
            message: "邮箱验证成功",
        });
    }
    catch (err) {
        console.error("验证验证码错误:", err);
        res.status(500).json({
            success: false,
            message: "服务器内部错误",
        });
    }
});
app.post("/api/register", async (req, res) => {
    const { username, password, email, registerCode, role, verificationCode } = req.body;
    const allowedRoles = ["regular", "enterprise", "admin"];
    try {
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "用户类型无效",
            });
        }
        // 验证邮箱验证码
        if (!verificationCode) {
            return res.status(400).json({
                success: false,
                message: "验证码不能为空",
            });
        }
        const validVerificationCode = await dataAccess_1.db.getValidVerificationCode(email, verificationCode);
        if (!validVerificationCode) {
            return res.status(400).json({
                success: false,
                message: "验证码无效或已过期",
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
        // 标记验证码为已使用
        await dataAccess_1.db.markVerificationCodeAsUsed(validVerificationCode.id);
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
                Accept: "text/event-stream",
            },
            responseType: "stream",
            timeout: DIFY_CHAT_TIMEOUT_MS,
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
        response.data.on("error", (streamError) => {
            console.error("Dify stream error:", streamError);
            if (!res.headersSent) {
                res.status(502).json({
                    error: "Dify stream error",
                    details: streamError instanceof Error ? streamError.message : "Unknown stream error",
                });
            }
            else {
                res.end();
            }
        });
        response.data.on("end", () => {
            res.end();
        });
    }
    catch (error) {
        console.error("Dify logic error:", error);
        if (axios_1.default.isAxiosError(error)) {
            if (error.code === "ECONNABORTED") {
                res.status(504).json({
                    error: "Dify upstream timeout",
                    details: `No response from Dify within ${DIFY_CHAT_TIMEOUT_MS}ms.`,
                });
                return;
            }
            res.status(502).json({
                error: "Dify request failed",
                details: error.message,
            });
            return;
        }
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
