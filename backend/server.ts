/**
 * Express 后端主入口文件
 * 功能模块：用户认证、邮箱验证、产品定制页面、台球杆订单、社区论坛、图片上传、AI聊天
 */

import express, { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import axios from "axios";
import fs from "fs";
import path from "path";
import multer from "multer";
import nodemailer from "nodemailer";
import { authenticateAdmin, authenticateToken } from "./auth";
import { db } from "./dataAccess";
import type { PoolCueOrderConfig, PoolCueOrderPriceLine } from "./Interface";

// ==================== 环境配置 ====================

/** 加载环境变量 */
dotenv.config();

/** Dify AI 聊天服务配置 */
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;
const DIFY_CHAT_TIMEOUT_MS = Number(process.env.DIFY_CHAT_TIMEOUT_MS || 45000);

/** 企业用户和管理员注册邀请码 */
const ENTERPRISE_REGISTER_CODE = process.env.ENTERPRISE_REGISTER_CODE || "6666";
const ADMIN_REGISTER_CODE = process.env.ADMIN_REGISTER_CODE || "8888";

// ==================== 邮件服务配置 ====================

/** SMTP 服务器配置 */
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

/** 验证码有效期（分钟）和发送频率限制 */
const VERIFICATION_CODE_EXPIRY_MINUTES = parseInt(
  process.env.VERIFICATION_CODE_EXPIRY_MINUTES || "10",
  10,
);
const MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES = parseInt(
  process.env.MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES || "3",
  10,
);

/**
 * 创建邮件传输器
 * @returns {nodemailer.Transporter} 邮件传输器实例
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 465端口使用SSL，其他使用TLS
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

/**
 * 生成6位数字验证码
 * @returns {string} 6位数字字符串
 */
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * 发送验证码邮件
 * @param {string} email - 目标邮箱地址
 * @param {string} code - 验证码
 * @returns {Promise<boolean>} 发送是否成功
 */
const sendVerificationEmail = async (
  email: string,
  code: string,
): Promise<boolean> => {
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
  } catch (error) {
    console.error("发送验证码邮件失败:", error);
    return false;
  }
};

// ==================== 数据库连接检查 ====================

/** 初始化数据库连接 */
db.checkConnection()
  .then(() => {
    console.log("数据库连接成功");
  })
  .catch((err) => console.error("数据库连接失败:", err));

// ==================== Express 应用配置 ====================

/** 创建 Express 应用实例 */
const app = express();
app.set("trust proxy", 1); // 信任代理，用于获取真实IP
app.use(cookieParser()); // 启用Cookie解析

/** CORS 跨域配置 - 仅允许本地开发环境 */
const allowedOrigins = ["http://localhost:3000"];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // 允许携带凭证（Cookie）
  }),
);
app.use(express.json()); // 解析 JSON 请求体

// ==================== 文件上传配置 ====================

/** 上传文件存储目录 */
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** 图片存储配置 */
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

/** 图片上传中间件配置 */
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 限制5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed"));
  },
});

/** 静态文件服务 - 提供上传的图片访问 */
app.use("/uploads", express.static(UPLOAD_DIR));

// ==================== 常量定义 ====================

/** JWT 密钥 */
const SECRET_KEY = process.env.JWT_SECRET || "";

/** 各字段长度限制常量 */
const MAX_BIO_LENGTH = 500; // 个人简介最大长度
const MAX_WORK_DESCRIPTION_LENGTH = 200; // 作品描述最大长度
const MAX_ORDER_CONTACT_NAME_LENGTH = 80; // 订单联系人姓名最大长度
const MAX_ORDER_CONTACT_PHONE_LENGTH = 30; // 订单联系电话最大长度
const MAX_ORDER_SHIPPING_ADDRESS_LENGTH = 500; // 订单配送地址最大长度
const MAX_ORDER_NOTE_LENGTH = 500; // 订单备注最大长度

// ==================== 辅助函数 ====================

/**
 * 规范化台球杆配置参数并验证
 * @param {unknown} input - 原始配置数据
 * @returns {PoolCueOrderConfig} 验证后的配置对象
 * @throws {Error} 当配置无效时抛出错误
 */
const normalizePoolCueConfig = (input: unknown): PoolCueOrderConfig => {
  if (!input || typeof input !== "object") {
    throw new Error("config is required");
  }

  const raw = input as Record<string, unknown>;
  const lengthCm = Number(raw.lengthCm);
  const weightOz = Number(raw.weightOz);
  const tipDiameterMm = Number(raw.tipDiameterMm);
  const jointType = String(raw.jointType || "").trim();
  const wrapType = String(raw.wrapType || "").trim();
  const finishStyle = String(raw.finishStyle || "").trim();
  const caseOption = String(raw.caseOption || "").trim();
  const includeLaserEngraving = Boolean(raw.includeLaserEngraving);

  // 验证长度范围：142-150cm
  if (!Number.isFinite(lengthCm) || lengthCm < 142 || lengthCm > 150) {
    throw new Error("lengthCm is invalid");
  }

  // 验证重量范围：17-21oz，且必须为0.5的倍数
  if (
    !Number.isFinite(weightOz) ||
    weightOz < 17 ||
    weightOz > 21 ||
    Math.round(weightOz * 2) !== weightOz * 2
  ) {
    throw new Error("weightOz is invalid");
  }

  // 验证杆头直径：只允许特定规格
  if (![10, 10.5, 11, 11.5, 12].includes(tipDiameterMm)) {
    throw new Error("tipDiameterMm is invalid");
  }

  // 验证接牙类型
  if (!["stainless-steel", "titanium"].includes(jointType)) {
    throw new Error("jointType is invalid");
  }

  // 验证握把类型
  if (!["carbon-grip", "genuine-leather", "none"].includes(wrapType)) {
    throw new Error("wrapType is invalid");
  }

  // 验证涂装样式
  if (
    ![
      "matte-carbon",
      "gloss-carbon",
      "stealth-black",
      "ice-silver",
      "ocean-blue",
      "crimson-red",
    ].includes(finishStyle)
  ) {
    throw new Error("finishStyle is invalid");
  }

  // 验证球杆盒选项
  if (!["none", "basic", "pro"].includes(caseOption)) {
    throw new Error("caseOption is invalid");
  }

  return {
    lengthCm,
    weightOz,
    tipDiameterMm,
    jointType: jointType as PoolCueOrderConfig["jointType"],
    wrapType: wrapType as PoolCueOrderConfig["wrapType"],
    finishStyle: finishStyle as PoolCueOrderConfig["finishStyle"],
    caseOption: caseOption as PoolCueOrderConfig["caseOption"],
    includeLaserEngraving,
  };
};

/**
 * 计算台球杆定制价格
 * @param {PoolCueOrderConfig} config - 台球杆配置
 * @returns {Object} 包含价格明细和总价的对象
 */
const calculatePoolCuePrice = (
  config: PoolCueOrderConfig,
): { lines: PoolCueOrderPriceLine[]; total: number } => {
  const lines: PoolCueOrderPriceLine[] = [
    { label: "碳纤维基础杆体", amount: 1880 },
    {
      label: `长度调整（${config.lengthCm}cm）`,
      amount: (config.lengthCm - 147) * 26,
    },
    {
      label: `重量调整（${config.weightOz}oz）`,
      amount: Math.round((config.weightOz - 19) * 80),
    },
    {
      label: `接牙类型：${config.jointType === "titanium" ? "钛合金" : "不锈钢"}`,
      amount: config.jointType === "titanium" ? 320 : 180,
    },
    {
      label:
        config.wrapType === "genuine-leather"
          ? "握把：真皮"
          : config.wrapType === "none"
            ? "握把：无缠把"
            : "握把：碳纤维防滑握把",
      amount:
        config.wrapType === "genuine-leather"
          ? 280
          : config.wrapType === "none"
            ? 0
            : 160,
    },
    {
      label:
        config.finishStyle === "gloss-carbon"
          ? "涂装：高亮碳纹"
          : config.finishStyle === "stealth-black"
            ? "涂装：隐形黑"
            : config.finishStyle === "ice-silver"
              ? "涂装：冰川银"
              : config.finishStyle === "ocean-blue"
                ? "涂装：海洋蓝"
                : config.finishStyle === "crimson-red"
                  ? "涂装：深红"
                  : "涂装：磨砂碳纹",
      amount:
        config.finishStyle === "matte-carbon"
          ? 0
          : config.finishStyle === "ice-silver" ||
              config.finishStyle === "ocean-blue"
            ? 280
            : 260,
    },
    {
      label:
        config.caseOption === "none"
          ? "球杆盒：不选择"
          : config.caseOption === "pro"
            ? "球杆盒：专业硬壳"
            : "球杆盒：基础软包",
      amount:
        config.caseOption === "none"
          ? 0
          : config.caseOption === "pro"
            ? 460
            : 180,
    },
  ];

  // 激光刻字额外收费
  if (config.includeLaserEngraving) {
    lines.push({ label: "激光刻字", amount: 160 });
  }

  return {
    lines,
    total: lines.reduce((sum, item) => sum + item.amount, 0),
  };
};

// ==================== API 路由 ====================

// -------------------- 用户认证相关 --------------------

/**
 * GET /api/me
 * 获取当前登录用户信息
 * 需要认证
 */
app.get("/api/me", authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.user_id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    const user = await db.getUserById(userId);

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
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * GET /api/admin/users
 * 管理员获取用户列表（支持搜索）
 * 需要管理员权限
 */
app.get(
  "/api/admin/users",
  authenticateToken,
  authenticateAdmin,
  async (req: Request, res: Response) => {
    const rawKeyword = req.query.keyword;
    const keyword =
      typeof rawKeyword === "string"
        ? rawKeyword.trim().slice(0, 100)
        : Array.isArray(rawKeyword)
          ? String(rawKeyword[0] ?? "")
              .trim()
              .slice(0, 100)
          : "";

    try {
      const users = await db.getUsersForAdmin(keyword, 100);
      return res.json({
        success: true,
        users,
      });
    } catch (err) {
      console.error("admin users query error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * GET /api/admin/orders
 * 管理员获取订单列表（支持搜索）
 * 需要管理员权限
 */
app.get(
  "/api/admin/orders",
  authenticateToken,
  authenticateAdmin,
  async (req: Request, res: Response) => {
    const rawKeyword = req.query.keyword;
    const keyword =
      typeof rawKeyword === "string"
        ? rawKeyword.trim().slice(0, 100)
        : Array.isArray(rawKeyword)
          ? String(rawKeyword[0] ?? "")
              .trim()
              .slice(0, 100)
          : "";

    try {
      const orders = await db.getOrdersForAdmin(keyword, 100);
      return res.json({
        success: true,
        orders,
      });
    } catch (err) {
      console.error("admin orders query error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * PATCH /api/admin/orders/:orderId/status
 * 管理员更新订单状态
 * 需要管理员权限
 */
app.patch(
  "/api/admin/orders/:orderId/status",
  authenticateToken,
  authenticateAdmin,
  async (req: Request, res: Response) => {
    const orderId = Array.isArray(req.params.orderId)
      ? req.params.orderId[0]
      : req.params.orderId;
    const { status } = req.body;

    const validStatuses = [
      "submitted",
      "processing",
      "shipped",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    try {
      const order = await db.updateOrderStatus(orderId, status);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
      return res.json({
        success: true,
        order,
      });
    } catch (err) {
      console.error("admin order status update error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// -------------------- 订单管理 --------------------

/**
 * POST /api/orders/pool-cue
 * 创建台球杆定制订单
 */
app.post(
  "/api/orders/pool-cue",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const {
      config,
      contact_name,
      contact_phone,
      shipping_address,
      order_note,
    } = req.body as {
      config?: unknown;
      contact_name?: string;
      contact_phone?: string;
      shipping_address?: string;
      order_note?: string | null;
    };

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const contactName = String(contact_name || "").trim();
    const contactPhone = String(contact_phone || "").trim();
    const shippingAddress = String(shipping_address || "").trim();
    const orderNote = String(order_note || "").trim();

    // 验证必填字段
    if (!contactName) {
      return res
        .status(400)
        .json({ success: false, message: "contact_name is required" });
    }

    if (!contactPhone) {
      return res
        .status(400)
        .json({ success: false, message: "contact_phone is required" });
    }

    if (!shippingAddress) {
      return res
        .status(400)
        .json({ success: false, message: "shipping_address is required" });
    }

    // 验证字段长度
    if (contactName.length > MAX_ORDER_CONTACT_NAME_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: "contact_name is too long" });
    }

    if (contactPhone.length > MAX_ORDER_CONTACT_PHONE_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: "contact_phone is too long" });
    }

    if (shippingAddress.length > MAX_ORDER_SHIPPING_ADDRESS_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: "shipping_address is too long" });
    }

    if (orderNote.length > MAX_ORDER_NOTE_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: "order_note is too long" });
    }

    try {
      const normalizedConfig = normalizePoolCueConfig(config);
      const pricing = calculatePoolCuePrice(normalizedConfig);
      const order = await db.createPoolCueOrder({
        userId,
        productName: "碳纤维台球杆",
        configuration: normalizedConfig,
        pricingLines: pricing.lines,
        totalPrice: pricing.total,
        contactName,
        contactPhone,
        shippingAddress,
        orderNote: orderNote || null,
      });

      return res.status(201).json({
        success: true,
        message: "Order created",
        order,
      });
    } catch (err) {
      console.error("create pool cue order error:", err);
      return res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : "Invalid request",
      });
    }
  },
);

// -------------------- 用户个人信息管理 --------------------

/**
 * GET /api/my_info
 * 获取当前用户完整个人信息
 */
app.get(
  "/api/my_info",
  authenticateToken,
  async (req: Request, res: Response) => {
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
          user_id: user.user_id,
          username: req.user?.username,
          role: req.user?.role,
          email: user.email,
          img_path: user.img_path || null,
          bio: user.bio || "",
        },
      });
    } catch (err) {
      console.error("my_info 错误:", err);
      res.status(500).json({
        success: false,
        message: "服务器内部错误",
      });
    }
  },
);

/**
 * GET /api/users/:userId/profile
 * 获取指定用户的公开资料（包含作品列表）
 */
app.get(
  "/api/users/:userId/profile",
  authenticateToken,
  async (req: Request, res: Response) => {
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
      const user = await db.getUserPublicProfileById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const works = await db.getUserWorksByUserId(targetUserId);
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
    } catch (err) {
      console.error("get user profile error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * PUT /api/my_info/avatar
 * 更新用户头像
 */
app.put(
  "/api/my_info/avatar",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const { img_path } = req.body as { img_path?: string | null };

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

    // 验证图片路径必须在 uploads 目录下
    if (typeof img_path === "string" && !img_path.startsWith("/uploads/")) {
      return res.status(400).json({
        success: false,
        message: "img_path must be under /uploads/",
      });
    }

    try {
      const updatedUser = await db.updateUserImagePathById(
        userId,
        img_path ?? null,
      );

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
    } catch (err) {
      console.error("update avatar error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * PUT /api/my_info/profile
 * 更新用户个人简介
 */
app.put(
  "/api/my_info/profile",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const rawBio = (req.body as { bio?: string | null }).bio;

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
      const updatedUser = await db.updateUserBioById(userId, bio || null);
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
    } catch (err) {
      console.error("update profile error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// -------------------- 用户作品管理 --------------------

/**
 * POST /api/my_info/works
 * 创建用户作品
 */
app.post(
  "/api/my_info/works",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const { image_path, description } = req.body as {
      image_path?: string;
      description?: string | null;
    };

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

    if (
      description !== null &&
      description !== undefined &&
      typeof description !== "string"
    ) {
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
      const work = await db.createUserWork({
        userId,
        imagePath,
        description: normalizedDescription || null,
      });

      return res.status(201).json({
        success: true,
        message: "Work created",
        work,
      });
    } catch (err) {
      console.error("create user work error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * DELETE /api/my_info/works/:workId
 * 删除用户作品
 */
app.delete(
  "/api/my_info/works/:workId",
  authenticateToken,
  async (req: Request, res: Response) => {
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
      const deleted = await db.deleteUserWorkByIdAndUserId(workId, userId);
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
    } catch (err) {
      console.error("delete user work error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// -------------------- 邮箱验证码 --------------------

/**
 * POST /api/send-verification-code
 * 发送邮箱验证码（注册用）
 */
app.post("/api/send-verification-code", async (req: Request, res: Response) => {
  const { email } = req.body;
  const ipAddress =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];

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
    const emailExists = await db.getUserByEmail(email);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "该邮箱已被注册",
      });
    }

    // 检查最近10分钟内的验证码发送次数
    const recentAttempts = await db.getRecentVerificationAttempts(email);
    if (recentAttempts >= MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES) {
      return res.status(429).json({
        success: false,
        message: "验证码发送过于频繁，请稍后再试",
      });
    }

    // 生成验证码
    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000,
    );

    // 保存验证码到数据库
    await db.createVerificationCode({
      email,
      code,
      expiresAt,
      ipAddress: typeof ipAddress === "string" ? ipAddress : undefined,
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
    await db.cleanupExpiredVerificationCodes();

    res.json({
      success: true,
      message: "验证码已发送到您的邮箱",
      expiresIn: VERIFICATION_CODE_EXPIRY_MINUTES * 60, // 返回秒数
    });
  } catch (err) {
    console.error("发送验证码错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

/**
 * POST /api/verify-email-code
 * 验证邮箱验证码
 */
app.post("/api/verify-email-code", async (req: Request, res: Response) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "邮箱和验证码不能为空",
      });
    }

    // 获取有效的验证码
    const verificationCode = await db.getValidVerificationCode(email, code);

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: "验证码无效或已过期",
      });
    }

    // 标记验证码为已使用
    await db.markVerificationCodeAsUsed(verificationCode.id);

    res.json({
      success: true,
      message: "邮箱验证成功",
    });
  } catch (err) {
    console.error("验证验证码错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

// -------------------- 认证相关 --------------------

/**
 * POST /api/register
 * 用户注册
 * 支持普通用户、管理员（需邀请码）
 */
app.post("/api/register", async (req: Request, res: Response) => {
  const { username, password, email, registerCode, role, verificationCode } =
    req.body;
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

    const validVerificationCode = await db.getValidVerificationCode(
      email,
      verificationCode,
    );
    if (!validVerificationCode) {
      return res.status(400).json({
        success: false,
        message: "验证码无效或已过期",
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

    // 验证管理员注册码
    if (role === "admin" && registerCode !== ADMIN_REGISTER_CODE) {
      return res.status(403).json({
        success: false,
        message: "管理员注册码错误",
      });
    }

    // 标记验证码为已使用
    await db.markVerificationCodeAsUsed(validVerificationCode.id);

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

/**
 * POST /api/login
 * 用户登录
 * 成功后在 Cookie 中设置 JWT Token
 */
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

    // 生成 JWT Token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
      SECRET_KEY,
      { expiresIn: "24h" },
    );

    // 设置 Cookie
    res.cookie("token", token, {
      httpOnly: true, // 防止XSS攻击
      secure: false, // 生产环境应设为true（HTTPS）
      sameSite: "lax", // CSRF防护
      maxAge: 24 * 60 * 60 * 1000, // 24小时
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
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

/**
 * POST /api/logout
 * 用户退出登录
 * 清除 Cookie 中的 Token
 */
app.post("/api/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ success: true, message: "退出成功" });
});

/**
 * POST /api/forget1
 * 密码找回第一步：验证用户名和邮箱
 */
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

/**
 * POST /api/forget2
 * 密码找回第二步：重置密码
 */
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

// -------------------- 社区论坛 --------------------

/**
 * GET /api/posts
 * 获取帖子列表（包含作者信息）
 */
app.get(
  "/api/posts",
  authenticateToken,
  async (req: Request, res: Response) => {
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
  },
);

/**
 * POST /api/posts
 * 创建新帖子
 */
app.post(
  "/api/posts",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const { title, content } = req.body as {
      title?: string;
      content?: string;
    };

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
      const post = await db.createPost({
        userId,
        title: trimmedTitle,
        content: trimmedContent,
      });

      return res.status(201).json({
        success: true,
        message: "Post created",
        post,
      });
    } catch (err) {
      console.error("create post error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * GET /api/posts/:postId
 * 获取帖子详情（包含评论列表）
 */
app.get(
  "/api/posts/:postId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: "postId is required",
      });
    }

    try {
      const post = await db.getPostDetailById(postId);

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      const comments = await db.getCommentsByPostId(postId);

      return res.json({
        success: true,
        post,
        comments,
      });
    } catch (err) {
      console.error("get post detail error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

/**
 * POST /api/posts/:postId/comments
 * 创建帖子评论
 */
app.post(
  "/api/posts/:postId/comments",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
    const { content } = req.body as { content?: string };
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
      const post = await db.getPostDetailById(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      const comment = await db.createComment({
        postId,
        userId,
        content: trimmedContent,
      });

      return res.status(201).json({
        success: true,
        message: "Comment created",
        comment,
      });
    } catch (err) {
      console.error("create comment error:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// -------------------- 文件上传 --------------------

/**
 * POST /api/images/upload
 * 上传图片文件
 * 限制：仅图片格式，最大5MB
 */
app.post(
  "/api/images/upload",
  authenticateToken,
  uploadImage.single("image"),
  async (req: Request, res: Response) => {
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
  },
);

// -------------------- 错误处理 --------------------

/**
 * 全局错误处理中间件
 * 处理 Multer 上传错误和其他错误
 */
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
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

// -------------------- AI 聊天 --------------------

/**
 * POST /api/chat
 * 与 Dify AI 进行流式对话
 * 使用 Server-Sent Events (SSE) 返回流式响应
 */
app.post(
  "/api/chat",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!DIFY_API_URL || !DIFY_API_KEY) {
        return res.status(500).json({
          error:
            "Dify is not configured. Please set DIFY_API_URL and DIFY_API_KEY.",
        });
      }

      const { message, conversation_id } = req.body;
      const userId = req.user?.user_id;

      // 设置 SSE 响应头
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
            Accept: "text/event-stream",
          },
          responseType: "stream",
          timeout: DIFY_CHAT_TIMEOUT_MS,
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

      // 将 Dify 的流式响应转发给客户端
      response.data.pipe(res);
      response.data.on("error", (streamError: unknown) => {
        console.error("Dify stream error:", streamError);
        if (!res.headersSent) {
          res.status(502).json({
            error: "Dify stream error",
            details:
              streamError instanceof Error
                ? streamError.message
                : "Unknown stream error",
          });
        } else {
          res.end();
        }
      });

      response.data.on("end", () => {
        res.end();
      });
    } catch (error) {
      console.error("Dify logic error:", error);
      if (axios.isAxiosError(error)) {
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
        details:
          error instanceof Error ? error.message : "Unknown backend error",
      });
      res.end();
    }
  },
);

// ==================== 服务器启动 ====================

/** 服务器监听端口 */
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
