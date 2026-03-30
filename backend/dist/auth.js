"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // 确保在这个文件读取 process.env 之前加载
const SECRET_KEY = process.env.JWT_SECRET; // JWT 密钥，如果不存在 dotenv.config() 会使其为 undefined
// 检查 SECRET_KEY 是否已加载，防止运行时错误
if (!SECRET_KEY) {
    console.error("Critical Error: JWT_SECRET is not defined in environment variables.");
    process.exit(1);
}
const authenticateToken = (req, // 使用增强后的 Request 类型
res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ success: false, message: "请先登录" });
    }
    // jwt.verify 的回调函数中，decoded 类型为 JwtPayload
    jsonwebtoken_1.default.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error("JWT 验证失败:", err); // 使用 console.error 记录错误
            return res
                .status(401)
                .json({ success: false, message: "登录失效，请重新登录" });
        }
        // 将解码后的数据断言为 JwtPayload 类型，并赋值给 req.user
        // 此时，req.user 就是 JwtPayload 类型
        req.user = decoded;
        next();
    });
};
exports.authenticateToken = authenticateToken;
// 专门验证管理员权限的中间件
const authenticateAdmin = (req, // 使用增强后的 Request 类型
res, next) => {
    // 此时 TypeScript 知道 req.user 可能是 JwtPayload 或 undefined
    // 所以你可以在这里安全地访问 req.user.isAdmin
    if (!req.user) {
        return res
            .status(401)
            .json({ success: false, message: "未授权或令牌无效" });
    }
    // req.user.isAdmin 现在有正确的类型提示
    if (req.user.role !== "admin") {
        return res
            .status(403)
            .json({ success: false, message: "权限不足，需要管理员身份" });
    }
    next();
};
exports.authenticateAdmin = authenticateAdmin;
