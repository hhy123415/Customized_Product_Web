/**
 * Express 后端主入口文件
 * 功能模块：用户认证、邮箱验证、产品定制订单、社区论坛、图片上传、AI聊天、积分兑换
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
import type {
  PoolCueOrderPriceLine,
  PoolCuePresetOrderConfig,
} from "./Interface";

// ==================== 环境配置 ====================
dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET || "";
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;
const DIFY_CHAT_TIMEOUT_MS = Number(process.env.DIFY_CHAT_TIMEOUT_MS || 45000);
const ADMIN_REGISTER_CODE = process.env.ADMIN_REGISTER_CODE || "8888";

// 邮件配置
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
const VERIFICATION_CODE_EXPIRY_MINUTES = parseInt(
  process.env.VERIFICATION_CODE_EXPIRY_MINUTES || "10",
  10,
);
const MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES = parseInt(
  process.env.MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES || "3",
  10,
);

// 奖品配置解析
const REWARDS_CONFIG: Record<string, { name: string; pointsRequired: number }> =
  {};
try {
  const raw = process.env.REWARDS_CONFIG || "[]";
  const list: { id: string; name: string; pointsRequired: number }[] =
    JSON.parse(raw);
  for (const item of list) {
    if (
      item.id &&
      item.name &&
      typeof item.pointsRequired === "number" &&
      item.pointsRequired > 0
    ) {
      REWARDS_CONFIG[item.id] = {
        name: item.name,
        pointsRequired: item.pointsRequired,
      };
    }
  }
  console.log("已加载奖品配置:", Object.keys(REWARDS_CONFIG));
} catch (err) {
  console.error("REWARDS_CONFIG 解析失败，请检查环境变量格式", err);
}

// ==================== 常量定义 ====================
const MAX_BIO_LENGTH = 500;
const MAX_WORK_DESCRIPTION_LENGTH = 200;
const MAX_ORDER_CONTACT_NAME_LENGTH = 80;
const MAX_ORDER_CONTACT_PHONE_LENGTH = 30;
const MAX_ORDER_SHIPPING_ADDRESS_LENGTH = 500;
const MAX_ORDER_NOTE_LENGTH = 500;
const MAX_FREEFORM_DESCRIPTION_LENGTH = 2000;
const MAX_FREEFORM_TEXT_LENGTH = 120;
const CHECK_IN_BASE_POINTS = 5;
const CHECK_IN_STREAK_BONUS_PER_DAY = 2;
const CHECK_IN_MAX_BONUS_DAYS = 7;

// ==================== 工具函数 ====================

/**
 * 生成6位数字验证码
 */
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * 创建邮件传输器
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

/**
 * 发送验证码邮件
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

/**
 * 计算台球杆定制价格
 */
const calculatePoolCuePrice = (
  config: PoolCuePresetOrderConfig,
): { lines: PoolCueOrderPriceLine[]; total: number } => {
  const lines: PoolCueOrderPriceLine[] = [
    { label: "基础杆体", amount: 1880 },
    {
      label: `长度调整(${config.lengthCm}cm)`,
      amount: (config.lengthCm - 147) * 26,
    },
    {
      label: `重量调整(${config.weightOz}oz)`,
      amount: Math.round((config.weightOz - 19) * 80),
    },
  ];

  if (config.jointType === "titanium") {
    lines.push({ label: "钛合金接牙", amount: 320 });
  }
  if (config.wrapType === "genuine-leather") {
    lines.push({ label: "真皮握把", amount: 280 });
  }
  if (config.finishStyle !== "matte-carbon") {
    lines.push({ label: "特殊涂装", amount: 260 });
  }
  if (config.caseOption === "pro") {
    lines.push({ label: "专业硬壳盒", amount: 460 });
  }

  return {
    lines,
    total: lines.reduce((sum, item) => sum + item.amount, 0),
  };
};

/**
 * 计算划船桨定制价格
 */
const calculateCarbonPaddlePrice = (
  config: Record<string, any>,
): { lines: { label: string; amount: number }[]; total: number } => {
  const lengthCm = Number(config?.lengthCm) || 220;
  const shaftFlex = String(config?.shaftFlex || "medium");
  const finishStyle = String(config?.finishStyle || "raw-carbon");
  const accessoryPack = String(config?.accessoryPack || "none");

  const lines = [{ label: "基础碳纤维划船桨", amount: 2280 }];
  lines.push({
    label: `长度定制(${lengthCm}cm)`,
    amount: (lengthCm - 220) * 28,
  });
  if (shaftFlex === "stiff") {
    lines.push({ label: "柔性桨杆调校", amount: 160 });
  }
  if (finishStyle !== "raw-carbon") {
    lines.push({ label: "定制表面涂装", amount: 220 });
  }
  if (accessoryPack === "touring") {
    lines.push({ label: "巡航收纳配件包", amount: 180 });
  } else if (accessoryPack === "expedition") {
    lines.push({ label: "远征配件包", amount: 360 });
  }

  return {
    lines,
    total: lines.reduce((sum, item) => sum + item.amount, 0),
  };
};

// ==================== Express 应用初始化 ====================
const app = express();
app.set("trust proxy", 1);
app.use(cookieParser());

const allowedOrigins = ["http://localhost:3000"];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// 文件上传配置
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

app.use("/uploads", express.static(UPLOAD_DIR));

// ==================== 数据库连接检查 ====================
db.checkConnection()
  .then(() => {
    console.log("数据库连接成功");
  })
  .catch((err) => console.error("数据库连接失败:", err));

// ==================== 路由模块 ====================

// ---------- 1. 用户认证与个人信息 ----------
app.get("/api/me", authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
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
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

app.get(
  "/api/my_info",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "用户不存在" });
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
          points: user.points || 0,
        },
      });
    } catch (err) {
      console.error("my_info 错误:", err);
      res.status(500).json({ success: false, message: "服务器内部错误" });
    }
  },
);

app.put(
  "/api/my_info/avatar",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const { img_path } = req.body as { img_path?: string | null };
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (img_path !== null && typeof img_path !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "img_path must be string or null" });
    }
    if (typeof img_path === "string" && !img_path.startsWith("/uploads/")) {
      return res
        .status(400)
        .json({ success: false, message: "img_path must be under /uploads/" });
    }
    try {
      const updatedUser = await db.updateUserImagePathById(
        userId,
        img_path ?? null,
      );
      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
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
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.put(
  "/api/my_info/profile",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const rawBio = (req.body as { bio?: string | null }).bio;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (rawBio !== null && rawBio !== undefined && typeof rawBio !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "bio must be string or null" });
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
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
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
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// ---------- 2. 签到与积分 ----------
app.get(
  "/api/my_info/check-in",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
      const [status, todayDate] = await Promise.all([
        db.getUserCheckInStatus(userId),
        db.getDatabaseCurrentDate(),
      ]);
      const currentStreak = (() => {
        if (!status.last_check_in_date) return 0;
        const today = new Date(`${todayDate}T00:00:00Z`);
        const lastCheckIn = new Date(`${status.last_check_in_date}T00:00:00Z`);
        const diffDays = Math.round(
          (today.getTime() - lastCheckIn.getTime()) / (24 * 60 * 60 * 1000),
        );
        return diffDays <= 1 ? status.current_streak : 0;
      })();
      const nextStreak = Math.max(1, currentStreak + 1);
      const bonusPoints =
        Math.min(nextStreak - 1, CHECK_IN_MAX_BONUS_DAYS) *
        CHECK_IN_STREAK_BONUS_PER_DAY;
      return res.json({
        success: true,
        check_in: {
          can_check_in: status.last_check_in_date !== todayDate,
          last_check_in_date: status.last_check_in_date,
          current_streak: currentStreak,
          today_base_points: CHECK_IN_BASE_POINTS,
          today_bonus_points: bonusPoints,
          today_total_points: CHECK_IN_BASE_POINTS + bonusPoints,
        },
      });
    } catch (err) {
      console.error("get check-in status error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.post(
  "/api/my_info/check-in",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
      const result = await db.createUserCheckIn({
        userId,
        basePoints: CHECK_IN_BASE_POINTS,
        bonusPerStreakDay: CHECK_IN_STREAK_BONUS_PER_DAY,
        maxBonusStreakDays: CHECK_IN_MAX_BONUS_DAYS,
      });
      if (result.alreadyCheckedIn) {
        return res.status(409).json({
          success: false,
          message: "Already checked in today",
          check_in: result.checkIn,
          points: result.points,
        });
      }
      return res.status(201).json({
        success: true,
        message: "Check-in successful",
        check_in: result.checkIn,
        points: result.points,
      });
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "23505"
      ) {
        return res
          .status(409)
          .json({ success: false, message: "Already checked in today" });
      }
      console.error("create check-in error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// 获取当前用户的积分变动记录
app.get(
  "/api/my_info/points/records",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
      const records = await db.getPointRecordsByUserId(userId);
      return res.json({ success: true, records });
    } catch (err) {
      console.error("get point records error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// 积分兑换
app.post(
  "/api/redeem",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "请先登录" });
    }
    const { reward_id, contact_name, contact_phone, shipping_address, note } =
      req.body;
    const rewardId = String(reward_id || "").trim();
    const rewardConfig = REWARDS_CONFIG[rewardId];
    if (!rewardConfig) {
      return res.status(400).json({ success: false, message: "奖品不存在" });
    }
    const contactName = String(contact_name || "").trim();
    const contactPhone = String(contact_phone || "").trim();
    const shippingAddress = String(shipping_address || "").trim();
    const noteText = String(note || "").trim();
    if (!contactName || contactName.length > 80)
      return res
        .status(400)
        .json({ success: false, message: "联系人姓名无效" });
    if (!contactPhone || contactPhone.length > 30)
      return res.status(400).json({ success: false, message: "联系电话无效" });
    if (!shippingAddress || shippingAddress.length > 500)
      return res.status(400).json({ success: false, message: "收货地址无效" });
    if (noteText.length > 200)
      return res.status(400).json({ success: false, message: "备注过长" });
    try {
      const result = await db.redeemReward({
        userId,
        rewardId,
        rewardName: rewardConfig.name,
        pointsRequired: rewardConfig.pointsRequired,
        contactName,
        contactPhone,
        shippingAddress,
        note: noteText || null,
      });
      return res
        .status(201)
        .json({ success: true, message: "兑换成功", ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "兑换失败";
      return res.status(400).json({ success: false, message });
    }
  },
);

// ---------- 3. 用户作品管理 ----------
app.post(
  "/api/my_info/works",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const { image_path, description } = req.body as {
      image_path?: string;
      description?: string | null;
    };
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const imagePath = (image_path || "").trim();
    if (!imagePath)
      return res
        .status(400)
        .json({ success: false, message: "image_path is required" });
    if (!imagePath.startsWith("/uploads/"))
      return res.status(400).json({
        success: false,
        message: "image_path must be under /uploads/",
      });
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
      return res
        .status(201)
        .json({ success: true, message: "Work created", work });
    } catch (err) {
      console.error("create user work error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.delete(
  "/api/my_info/works/:workId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const rawWorkId = req.params.workId;
    const workId = Array.isArray(rawWorkId) ? rawWorkId[0] : rawWorkId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!workId)
      return res
        .status(400)
        .json({ success: false, message: "workId is required" });
    try {
      const deleted = await db.deleteUserWorkByIdAndUserId(workId, userId);
      if (!deleted)
        return res
          .status(404)
          .json({ success: false, message: "Work not found" });
      return res.json({
        success: true,
        message: "Work deleted",
        work: deleted,
      });
    } catch (err) {
      console.error("delete user work error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// 查看他人公开资料（含作品）
app.get(
  "/api/users/:userId/profile",
  authenticateToken,
  async (req: Request, res: Response) => {
    const rawUserId = req.params.userId;
    const targetUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const currentUserId = req.user?.user_id;
    if (!targetUserId)
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    try {
      const user = await db.getUserPublicProfileById(targetUserId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
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
          is_certified_designer: user.is_certified_designer,
          created_at: user.created_at,
        },
        works,
      });
    } catch (err) {
      console.error("get user profile error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// ---------- 4. 认证路由（注册、登录、登出、密码找回） ----------
app.post("/api/register", async (req: Request, res: Response) => {
  const { username, password, email, registerCode, role, verificationCode } =
    req.body;
  const points = 100;
  const allowedRoles = ["regular", "enterprise", "admin"];
  try {
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "用户类型无效" });
    }
    if (!verificationCode) {
      return res
        .status(400)
        .json({ success: false, message: "验证码不能为空" });
    }
    const validVerificationCode = await db.getValidVerificationCode(
      email,
      verificationCode,
    );
    if (!validVerificationCode) {
      return res
        .status(400)
        .json({ success: false, message: "验证码无效或已过期" });
    }
    const userExists = await db.getUserByUsername(username);
    if (userExists) {
      return res.status(409).json({ success: false, message: "用户名已存在" });
    }
    const emailExists = await db.getUserByEmail(email);
    if (emailExists) {
      return res.status(409).json({ success: false, message: "邮箱已存在" });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    if (role === "admin" && registerCode !== ADMIN_REGISTER_CODE) {
      return res
        .status(403)
        .json({ success: false, message: "管理员注册码错误" });
    }
    await db.markVerificationCodeAsUsed(validVerificationCode.id);
    await db.createUser({
      username,
      passwordHash: hashedPassword,
      email,
      role,
      points,
    });
    res.status(201).json({ success: true, message: "注册成功" });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
  }
});

app.post("/api/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "用户名或密码错误" });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res
        .status(401)
        .json({ success: false, message: "用户名或密码错误" });
    }
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
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
      img_path: user.img_path || null,
    });
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
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
      return res.json({ success: false, message: "用户名或邮箱错误" });
    }
    res.json({ success: true, message: "用户名和邮箱匹配成功" });
  } catch (err) {
    console.error("forget1 错误:", err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
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
      return res.json({ success: false, message: "用户名未找到" });
    }
    res.json({ success: true, message: "密码修改成功" });
  } catch (err) {
    console.error("forget2 错误:", err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
  }
});

// ---------- 5. 邮箱验证 ----------
app.post("/api/send-verification-code", async (req: Request, res: Response) => {
  const { email } = req.body;
  const ipAddress =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];
  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "邮箱地址不能为空" });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res
        .status(400)
        .json({ success: false, message: "邮箱格式不正确" });
    const emailExists = await db.getUserByEmail(email);
    if (emailExists)
      return res
        .status(409)
        .json({ success: false, message: "该邮箱已被注册" });
    const recentAttempts = await db.getRecentVerificationAttempts(email);
    if (recentAttempts >= MAX_VERIFICATION_ATTEMPTS_PER_10_MINUTES) {
      return res
        .status(429)
        .json({ success: false, message: "验证码发送过于频繁，请稍后再试" });
    }
    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000,
    );
    await db.createVerificationCode({
      email,
      code,
      expiresAt,
      ipAddress: typeof ipAddress === "string" ? ipAddress : undefined,
      userAgent,
    });
    const emailSent = await sendVerificationEmail(email, code);
    if (!emailSent)
      return res
        .status(500)
        .json({ success: false, message: "验证码发送失败，请稍后重试" });
    await db.cleanupExpiredVerificationCodes();
    res.json({
      success: true,
      message: "验证码已发送到您的邮箱",
      expiresIn: VERIFICATION_CODE_EXPIRY_MINUTES * 60,
    });
  } catch (err) {
    console.error("发送验证码错误:", err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
  }
});

app.post("/api/verify-email-code", async (req: Request, res: Response) => {
  const { email, code } = req.body;
  try {
    if (!email || !code)
      return res
        .status(400)
        .json({ success: false, message: "邮箱和验证码不能为空" });
    const verificationCode = await db.getValidVerificationCode(email, code);
    if (!verificationCode)
      return res
        .status(400)
        .json({ success: false, message: "验证码无效或已过期" });
    await db.markVerificationCodeAsUsed(verificationCode.id);
    res.json({ success: true, message: "邮箱验证成功" });
  } catch (err) {
    console.error("验证验证码错误:", err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
  }
});

// ---------- 6. 订单管理 ----------
app.get(
  "/api/orders/my",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const rawKeyword = req.query.keyword;
    const keyword =
      typeof rawKeyword === "string" ? rawKeyword.trim().slice(0, 100) : "";
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    try {
      const orders = await db.getOrdersForUser(userId, keyword, 100);
      return res.json({ success: true, orders });
    } catch (err) {
      console.error("user orders query error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.patch(
  "/api/orders/:orderId/cancel",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const orderId = Array.isArray(req.params.orderId)
      ? req.params.orderId[0]
      : req.params.orderId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    try {
      const order = await db.cancelOrderForUser(orderId, userId);
      if (!order)
        return res.status(404).json({
          success: false,
          message: "Order not found or cannot be cancelled",
        });
      return res.json({ success: true, order });
    } catch (err) {
      console.error("user cancel order error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.post(
  "/api/orders/pool-cue",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const {
      config,
      customization_mode,
      contact_name,
      contact_phone,
      shipping_address,
      order_note,
      design_image_path,
      design_description,
    } = req.body;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const contactName = String(contact_name || "").trim();
    const contactPhone = String(contact_phone || "").trim();
    const shippingAddress = String(shipping_address || "").trim();
    const orderNote = String(order_note || "").trim();
    const designImagePath = String(design_image_path || "").trim();
    const designDescription = String(design_description || "").trim();
    if (!contactName)
      return res
        .status(400)
        .json({ success: false, message: "contact_name is required" });
    if (!contactPhone)
      return res
        .status(400)
        .json({ success: false, message: "contact_phone is required" });
    if (!shippingAddress)
      return res
        .status(400)
        .json({ success: false, message: "shipping_address is required" });
    if (contactName.length > MAX_ORDER_CONTACT_NAME_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "contact_name is too long" });
    if (contactPhone.length > MAX_ORDER_CONTACT_PHONE_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "contact_phone is too long" });
    if (shippingAddress.length > MAX_ORDER_SHIPPING_ADDRESS_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "shipping_address is too long" });
    if (orderNote.length > MAX_ORDER_NOTE_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "order_note is too long" });
    if (designImagePath && !designImagePath.startsWith("/uploads/"))
      return res.status(400).json({
        success: false,
        message: "design_image_path must be under /uploads/",
      });
    if (designDescription.length > MAX_FREEFORM_DESCRIPTION_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "design_description is too long" });
    const customizationMode =
      customization_mode === "freeform" ? "freeform" : "preset";
    try {
      let orderPayload: any;
      if (customizationMode === "freeform") {
        orderPayload = {
          configuration: {},
          pricingLines: [],
          totalPrice: 0,
          designImagePath: designImagePath || null,
          designDescription: designDescription || null,
        };
      } else {
        const pricing = calculatePoolCuePrice(config);
        orderPayload = {
          configuration: config,
          pricingLines: pricing.lines,
          totalPrice: pricing.total,
          designImagePath: null,
          designDescription: null,
        };
      }
      const order = await db.createPoolCueOrder({
        userId,
        productName: "碳纤维台球杆",
        contactName,
        contactPhone,
        shippingAddress,
        orderNote: orderNote || null,
        customizationMode,
        ...orderPayload,
      });
      return res
        .status(201)
        .json({ success: true, message: "Order created", order });
    } catch (err) {
      console.error("create pool cue order error:", err);
      return res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : "Invalid request",
      });
    }
  },
);

app.post(
  "/api/orders/carbon-paddle",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const {
      config,
      customization_mode,
      contact_name,
      contact_phone,
      shipping_address,
      order_note,
      design_image_path,
      design_description,
    } = req.body;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const contactName = String(contact_name || "").trim();
    const contactPhone = String(contact_phone || "").trim();
    const shippingAddress = String(shipping_address || "").trim();
    const orderNote = String(order_note || "").trim();
    const designImagePath = String(design_image_path || "").trim();
    const designDescription = String(design_description || "").trim();
    if (!contactName)
      return res
        .status(400)
        .json({ success: false, message: "contact_name is required" });
    if (!contactPhone)
      return res
        .status(400)
        .json({ success: false, message: "contact_phone is required" });
    if (!shippingAddress)
      return res
        .status(400)
        .json({ success: false, message: "shipping_address is required" });
    if (contactName.length > MAX_ORDER_CONTACT_NAME_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "contact_name is too long" });
    if (contactPhone.length > MAX_ORDER_CONTACT_PHONE_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "contact_phone is too long" });
    if (shippingAddress.length > MAX_ORDER_SHIPPING_ADDRESS_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "shipping_address is too long" });
    if (orderNote.length > MAX_ORDER_NOTE_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "order_note is too long" });
    if (designImagePath && !designImagePath.startsWith("/uploads/"))
      return res.status(400).json({
        success: false,
        message: "design_image_path must be under /uploads/",
      });
    if (designDescription.length > MAX_FREEFORM_DESCRIPTION_LENGTH)
      return res
        .status(400)
        .json({ success: false, message: "design_description is too long" });
    const customizationMode =
      customization_mode === "freeform" ? "freeform" : "preset";
    try {
      let orderPayload: any;
      if (customizationMode === "freeform") {
        orderPayload = {
          configuration: config || {},
          pricingLines: [],
          totalPrice: 0,
          designImagePath: designImagePath || null,
          designDescription: designDescription || null,
        };
      } else {
        const pricing = calculateCarbonPaddlePrice(config || {});
        orderPayload = {
          configuration: config || {},
          pricingLines: pricing.lines,
          totalPrice: pricing.total,
          designImagePath: null,
          designDescription: null,
        };
      }
      const order = await db.createPoolCueOrder({
        userId,
        productName: "碳纤维划船桨",
        contactName,
        contactPhone,
        shippingAddress,
        orderNote: orderNote || null,
        customizationMode,
        ...orderPayload,
      });
      return res
        .status(201)
        .json({ success: true, message: "Order created", order });
    } catch (err) {
      console.error("create carbon paddle order error:", err);
      return res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : "Invalid request",
      });
    }
  },
);

// ---------- 7. 管理员接口 ----------
app.get(
  "/api/admin/users",
  authenticateToken,
  authenticateAdmin,
  async (req: Request, res: Response) => {
    const rawKeyword = req.query.keyword;
    const keyword =
      typeof rawKeyword === "string" ? rawKeyword.trim().slice(0, 100) : "";
    try {
      const users = await db.getUsersForAdmin(keyword, 100);
      return res.json({ success: true, users });
    } catch (err) {
      console.error("admin users query error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.get(
  "/api/admin/orders",
  authenticateToken,
  authenticateAdmin,
  async (req: Request, res: Response) => {
    const rawKeyword = req.query.keyword;
    const keyword =
      typeof rawKeyword === "string" ? rawKeyword.trim().slice(0, 100) : "";
    try {
      const orders = await db.getOrdersForAdmin(keyword, 100);
      return res.json({ success: true, orders });
    } catch (err) {
      console.error("admin orders query error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

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
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }
    try {
      const order = await db.updateOrderStatus(orderId, status);
      if (!order)
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      return res.json({ success: true, order });
    } catch (err) {
      console.error("admin order status update error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// ---------- 8. 社区论坛 ----------
app.get(
  "/api/posts",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const posts = await db.getPostsWithAuthor();
      res.json({ success: true, posts });
    } catch (err) {
      console.error("posts 错误:", err);
      res.status(500).json({ success: false, message: "服务器内部错误" });
    }
  },
);

app.post(
  "/api/posts",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const { title, content, access_level, points_required, preview_length } =
      req.body as {
        title?: string;
        content?: string;
        access_level?: string;
        points_required?: number;
        preview_length?: number;
      };

    const trimmedTitle = (title || "").trim();
    const trimmedContent = (content || "").trim();
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!trimmedTitle || !trimmedContent)
      return res
        .status(400)
        .json({ success: false, message: "title and content are required" });
    if (trimmedTitle.length > 255)
      return res
        .status(400)
        .json({ success: false, message: "title is too long (max 255)" });

    // 访问控制字段校验
    const accessLevel = access_level || "public";
    const validLevels = ["public", "owner_admin", "points"];
    if (!validLevels.includes(accessLevel)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid access_level" });
    }
    const pointsRequired = Number(points_required) || 0;
    if (accessLevel === "points" && pointsRequired <= 0) {
      return res.status(400).json({
        success: false,
        message: "points_required must be positive for points access",
      });
    }
    const previewLength = Number(preview_length) || 150;
    if (previewLength < 0) {
      return res
        .status(400)
        .json({ success: false, message: "preview_length must be >= 0" });
    }

    try {
      const post = await db.createPost({
        userId,
        title: trimmedTitle,
        content: trimmedContent,
        accessLevel: accessLevel,
        pointsRequired: pointsRequired,
        previewLength: previewLength,
      });
      return res
        .status(201)
        .json({ success: true, message: "Post created", post });
    } catch (err) {
      console.error("create post error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// 简单截断 Markdown 的工具函数（按字符截断）
function truncateMarkdown(md: string, maxLength: number): string {
  if (maxLength <= 0) return ""; // 如果不提供预览，返回空字符串
  if (md.length <= maxLength) return md;
  return md.slice(0, maxLength) + "……"; // 用……表示截断
}

app.get(
  "/api/posts/:postId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
    if (!postId)
      return res
        .status(400)
        .json({ success: false, message: "postId is required" });

    const currentUser = req.user; // 包含 user_id, username, role
    try {
      const post = await db.getPostDetailById(postId); // 返回新字段access_level
      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });

      const isOwner = currentUser?.user_id === post.author_user_id;
      const isAdmin = currentUser?.role === "admin";
      let contentToReturn = post.content;
      let contentLocked = false;

      // 访问控制判断
      if (post.access_level !== "public") {
        if (post.access_level === "owner_admin") {
          if (!isOwner && !isAdmin) {
            contentLocked = true;
            contentToReturn = truncateMarkdown(
              post.content,
              post.preview_length,
            );
          }
        } else if (post.access_level === "points") {
          // 积分解锁：暂时没有解锁记录，全部锁住；未来可增加判断
          // 即使是帖主/管理员，在 points 模式下也应能直接查看？根据业务，帖主/管理员理应可以看完整内容
          if (!isOwner && !isAdmin) {
            contentLocked = true;
            contentToReturn = truncateMarkdown(
              post.content,
              post.preview_length,
            );
          }
        }
      }

      // 获取评论（锁定状态下不返回）
      const comments = contentLocked
        ? [] // ❗️ 不返回任何评论
        : await db.getCommentsByPostId(postId);

      // 返回时附带访问控制相关字段，便于前端处理
      return res.json({
        success: true,
        post: {
          ...post,
          content: contentToReturn,
          content_locked: contentLocked,
        },
        comments,
      });
    } catch (err) {
      console.error("get post detail error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

app.post(
  "/api/posts/:postId/comments",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const rawPostId = req.params.postId;
    const postId = Array.isArray(rawPostId) ? rawPostId[0] : rawPostId;
    const { content } = req.body as { content?: string };
    const trimmedContent = (content || "").trim();
    if (!postId)
      return res
        .status(400)
        .json({ success: false, message: "postId is required" });
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!trimmedContent)
      return res
        .status(400)
        .json({ success: false, message: "content is required" });
    try {
      const post = await db.getPostDetailById(postId);
      if (!post)
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });

      // 若帖子非公开且当前用户不是帖主或管理员，禁止评论
      if (post.access_level !== "public") {
        const isOwner = req.user?.user_id === post.author_user_id;
        const isAdmin = req.user?.role === "admin";
        if (!isOwner && !isAdmin) {
          return res
            .status(403)
            .json({ success: false, message: "你没有权限评论此帖子" });
        }
      }

      const comment = await db.createComment({
        postId,
        userId,
        content: trimmedContent,
      });
      return res
        .status(201)
        .json({ success: true, message: "Comment created", comment });
    } catch (err) {
      console.error("create comment error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

// ---------- 9. 图片上传 ----------
app.post(
  "/api/images/upload",
  authenticateToken,
  uploadImage.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image file uploaded" });
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

// ---------- 10. AI 聊天 ----------
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
        res
          .status(502)
          .json({ error: "Dify request failed", details: error.message });
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

// ==================== 错误处理中间件 ====================
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
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// ==================== 服务器启动 ====================
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
