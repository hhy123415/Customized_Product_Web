import { Request, Response, NextFunction } from "express"; // 引入 Request, Response, NextFunction
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config(); // 确保在这个文件读取 process.env 之前加载

interface JwtPayload {
  user_id: string; // 用户ID，用于数据库查询等
  username: string; // 用户名
  role: string; // 账号类型
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload; // req.user 属性现在是可选的 JwtPayload 类型
    }
  }
}

const SECRET_KEY = process.env.JWT_SECRET; // JWT 密钥，如果不存在 dotenv.config() 会使其为 undefined

// 检查 SECRET_KEY 是否已加载，防止运行时错误
if (!SECRET_KEY) {
  console.error(
    "Critical Error: JWT_SECRET is not defined in environment variables.",
  );
  process.exit(1);
}

export const authenticateToken = (
  req: Request, // 使用增强后的 Request 类型
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ success: false, message: "请先登录" });
  }

  // jwt.verify 的回调函数中，decoded 类型为 JwtPayload
  jwt.verify(token, SECRET_KEY, (err: any, decoded: any) => {
    if (err) {
      console.error("JWT 验证失败:", err); // 使用 console.error 记录错误
      return res
        .status(401)
        .json({ success: false, message: "登录失效，请重新登录" });
    }
    // 将解码后的数据断言为 JwtPayload 类型，并赋值给 req.user
    // 此时，req.user 就是 JwtPayload 类型
    req.user = decoded as JwtPayload;
    next();
  });
};

// 专门验证管理员权限的中间件
export const authenticateAdmin = (
  req: Request, // 使用增强后的 Request 类型
  res: Response,
  next: NextFunction,
) => {
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
