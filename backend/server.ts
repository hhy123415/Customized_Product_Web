import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import axios from "axios";
import { authenticateToken } from "./auth";
import { db } from "./dataAccess";

dotenv.config();

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;
const ENTERPRISE_REGISTER_CODE = process.env.ENTERPRISE_REGISTER_CODE || "6666";
const ADMIN_REGISTER_CODE = process.env.ADMIN_REGISTER_CODE || "8888";

db
  .checkConnection()
  .then(() => {
    console.log("数据库连接成功");
  })
  .catch((err) => console.error("数据库连接失败:", err));

const app = express();
app.use(cookieParser());

const allowedOrigins = ["http://localhost:3000"];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || "";

app.get("/api/me", authenticateToken, async (req: Request, res: Response) => {
  res.json({
    success: true,
    user: {
      user_id: req.user?.user_id,
      username: req.user?.username,
      role: req.user?.role,
    },
  });
});

app.get("/api/my_info", authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.user_id;

  try {
    const user = await db.getUserById(userId);

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
      },
    });
  } catch (err) {
    console.error("my_info 错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

app.post("/api/register", async (req: Request, res: Response) => {
  const { username, password, email, registerCode, role } = req.body;
  const allowedRoles = ["regular", "enterprise", "admin"];

  try {
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "用户类型无效",
      });
    }

    const userExists = await db.getUserByUsername(username);
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "用户名已存在",
      });
    }

    const emailExists = await db.getUserByEmail(email);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "邮箱已存在",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

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

    await db.createUser({
      username,
      passwordHash: hashedPassword,
      email,
      role,
    });

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

app.post("/api/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await db.getUserByUsername(username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "用户名或密码错误",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "用户名或密码错误",
      });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
      SECRET_KEY,
      { expiresIn: "24h" },
    );

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
    });
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

app.post("/api/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ success: true, message: "退出成功" });
});

app.post("/api/forget1", async (req: Request, res: Response) => {
  const { username, email } = req.body;

  try {
    const user = await db.getUserByUsernameAndEmail(username, email);

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
  } catch (err) {
    console.error("forget1 错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

app.post("/api/forget2", async (req: Request, res: Response) => {
  const { username, newPassword } = req.body;

  if (String(newPassword).length < 6) {
    return res.status(409).json({ success: false, message: "密码长度至少6位" });
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  try {
    const updatedUser = await db.updateUserPasswordByUsername(
      username,
      hashedPassword,
    );

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
  } catch (err) {
    console.error("forget2 错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

app.get("/api/posts", authenticateToken, async (req: Request, res: Response) => {
  try {
    const posts = await db.getPostsWithAuthor();

    res.json({
      success: true,
      posts,
    });
  } catch (err) {
    console.error("posts 错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

app.post("/api/chat", authenticateToken, async (req: Request, res: Response) => {
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

    const response = await axios.post(
      `${DIFY_API_URL}/chat-messages`,
      {
        inputs: {},
        query: message,
        response_mode: "streaming",
        user: userId || "default_user",
        conversation_id: conversation_id || "",
      },
      {
        headers: {
          Authorization: `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
        validateStatus: () => true,
      },
    );

    if (response.status < 200 || response.status >= 300) {
      let errorBody = "";

      response.data.on("data", (chunk: Buffer) => {
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
  } catch (error) {
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
