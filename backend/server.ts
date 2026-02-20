import express, { Request, Response } from "express";
import { Pool, QueryResult } from "pg";
import bcrypt from "bcrypt";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { authenticateToken } from "./auth";
import type { UserRow } from "./Interface";

dotenv.config();

// 连接数据库配置
const pool = new Pool({
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

const app = express();
app.use(cookieParser());

//前端来源(localhost后续应改为服务器ip)
const allowedOrigins = ["http://localhost:3000"];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
const SECRET_KEY = process.env.JWT_SECRET || "";

// --- 获取当前用户信息接口 (AuthProvider 初始化时调用) ---
app.get("/api/me", authenticateToken, async (req: Request, res: Response) => {
  res.json({
    success: true,
    user: {
      user_id: req.user?.user_id,
      username: req.user?.username,
      isAdmin: req.user?.isAdmin,
    },
  });
});

// --- 注册接口 ---
app.post("/api/register", async (req: Request, res: Response) => {
  const { username, password, email, registerCode, role } = req.body;

  try {
    // 检查用户是否已存在 (使用泛型确保返回类型)
    const userExists: QueryResult<UserRow> = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username],
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "用户名已存在",
      });
    }

    // 检查邮箱是否已存在
    const emailExists: QueryResult<UserRow> = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    if (emailExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "邮箱已存在",
      });
    }

    //完善密码加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 判断是否是企业用户（注册码后续可优化）
    if (role === "enterprise") {
      if(registerCode!="6666")
      {
        return res.status(403).json({
          success: false,
          message: "注册码错误",
        });
      }
    }

    // 插入新用户 (存储加密后的密码)
    await pool.query(
      "INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)",
      [username, hashedPassword, email, role],
    );

    res.status(201).json({
      success: true,
      message: "注册成功",
    });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});