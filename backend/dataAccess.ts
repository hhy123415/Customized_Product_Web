import { Pool } from "pg";
import type {
  AdminUserRow,
  CommentRow,
  PoolCueOrderConfig,
  PoolCueOrderPriceLine,
  PoolCueOrderRow,
  PostDetailRow,
  PostRow,
  UserPublicProfileRow,
  UserRow,
  UserWorkRow,
  EmailVerificationCodeRow,
  AdminOrderRow,
  UserCheckInRow,
  UserCheckInStatusRow,
  PointRecordRow,
} from "./Interface";

/** 数据库连接池配置 */
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "", 10),
});

export const db = {
  /** 用户取消订单（仅限已提交或处理中的订单） */
  async cancelOrderForUser(
    orderId: string,
    userId: string,
  ): Promise<AdminOrderRow | null> {
    const result = await pool.query<AdminOrderRow>(
      `
      UPDATE orders
      SET status = 'cancelled', updated_at = NOW()
      WHERE
        order_id = $1
        AND user_id = $2
        AND status IN ('submitted', 'processing')
      RETURNING
        order_id,
        user_id,
        (SELECT username FROM users WHERE user_id = orders.user_id) as username,
        product_name,
        customization_mode,
        configuration,
        pricing_lines,
        total_price,
        contact_name,
        contact_phone,
        shipping_address,
        order_note,
        design_image_path,
        design_description,
        status,
        created_at,
        updated_at
    `,
      [orderId, userId],
    );
    return result.rows[0] || null;
  },

  /** 检查数据库连接是否正常 */
  async checkConnection(): Promise<void> {
    const client = await pool.connect();
    client.release();
  },

  /** 定期清理过期的邮箱验证码记录 */
  async cleanupExpiredVerificationCodes(): Promise<void> {
    await pool.query(
      "DELETE FROM email_verification_codes WHERE expires_at < CURRENT_TIMESTAMP",
    );
  },

  /** 为帖子创建新评论，并返回包含作者信息的评论记录 */
  async createComment(params: {
    postId: string;
    userId: string;
    content: string;
  }): Promise<CommentRow> {
    const { postId, userId, content } = params;
    const result = await pool.query<CommentRow>(
      `
        INSERT INTO comments (post_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING comment_id, post_id, content, created_at, updated_at
      `,
      [postId, userId, content],
    );

    const inserted = result.rows[0];
    const commentWithAuthor = await pool.query<CommentRow>(
      `
        SELECT
          c.comment_id,
          c.post_id,
          c.content,
          c.created_at,
          c.updated_at,
          u.user_id AS author_user_id,
          u.username AS author_username,
          u.img_path AS author_img_path
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = $1
      `,
      [inserted.comment_id],
    );

    return commentWithAuthor.rows[0];
  },

  /** 创建新的球杆定制订单 */
  async createPoolCueOrder(params: {
    userId: string;
    productName: string;
    configuration: PoolCueOrderConfig;
    pricingLines: PoolCueOrderPriceLine[];
    totalPrice: number;
    contactName: string;
    contactPhone: string;
    shippingAddress: string;
    orderNote: string | null;
    customizationMode: PoolCueOrderRow["customization_mode"];
    designImagePath: string | null;
    designDescription: string | null;
  }): Promise<PoolCueOrderRow> {
    const {
      userId,
      productName,
      configuration,
      pricingLines,
      totalPrice,
      contactName,
      contactPhone,
      shippingAddress,
      orderNote,
      customizationMode,
      designImagePath,
      designDescription,
    } = params;

    const result = await pool.query<PoolCueOrderRow>(
      `
        INSERT INTO orders (
          user_id,
          product_name,
          customization_mode,
          configuration,
          pricing_lines,
          total_price,
          contact_name,
          contact_phone,
          shipping_address,
          order_note,
          design_image_path,
          design_description,
          status
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, 'submitted')
        RETURNING
          order_id,
          user_id,
          product_name,
          customization_mode,
          configuration,
          pricing_lines,
          total_price,
          contact_name,
          contact_phone,
          shipping_address,
          order_note,
          design_image_path,
          design_description,
          status,
          created_at,
          updated_at
      `,
      [
        userId,
        productName,
        customizationMode,
        JSON.stringify(configuration),
        JSON.stringify(pricingLines),
        totalPrice,
        contactName,
        contactPhone,
        shippingAddress,
        orderNote,
        designImagePath,
        designDescription,
      ],
    );

    return result.rows[0];
  },

  /** 发布新帖子 */
  async createPost(params: {
    userId: string;
    title: string;
    content: string;
    accessLevel: string;
    pointsRequired: number;
    previewLength: number;
  }): Promise<PostRow> {
    const {
      userId,
      title,
      content,
      accessLevel,
      pointsRequired,
      previewLength,
    } = params;
    const result = await pool.query<PostRow>(
      `
        INSERT INTO posts (user_id, title, content,access_level, points_required, preview_length)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING post_id, title, content, reply_count,access_level, created_at, updated_at
      `,
      [userId, title, content, accessLevel, pointsRequired, previewLength],
    );

    const inserted = result.rows[0];
    const postWithAuthor = await pool.query<PostRow>(
      `
        SELECT
          p.post_id,
          p.title,
          p.content,
          p.reply_count,
          p.access_level,
          p.created_at,
          p.updated_at,
          u.username AS author_username,
          u.img_path AS author_img_path
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.post_id = $1
      `,
      [inserted.post_id],
    );

    return postWithAuthor.rows[0];
  },

  /** 创建新用户记录 */
  async createUser(params: {
    username: string;
    passwordHash: string;
    email: string;
    role: string;
    points: number;
  }): Promise<number> {
    const { username, passwordHash, email, role, points } = params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. 创建用户
      const userResult = await client.query<{ user_id: number }>(
        `INSERT INTO users (username, password_hash, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id`,
        [username, passwordHash, email, role],
      );
      const userId = userResult.rows[0].user_id;

      // 2. 插入积分赠送记录
      //    触发器 trg_point_records_sync_points 会自动将 users.points 设为 points
      await client.query(
        `INSERT INTO point_records (user_id, points_change, points_after, detail)
       VALUES ($1, $2, $3, '注册赠送')`,
        [userId, points, points],
      );

      await client.query("COMMIT");
      return userId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  /** 执行用户签到逻辑（包含事务处理、连续签到天数计算及积分发放） */
  async createUserCheckIn(params: {
    userId: string;
    basePoints: number;
    bonusPerStreakDay: number;
    maxBonusStreakDays: number;
  }): Promise<{
    checkIn: UserCheckInRow;
    points: number;
    alreadyCheckedIn: boolean;
  }> {
    const { userId, basePoints, bonusPerStreakDay, maxBonusStreakDays } =
      params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 查询最近一次签到记录
      const latestResult = await client.query<UserCheckInStatusRow>(
        `
        SELECT
          TO_CHAR(check_in_date, 'YYYY-MM-DD') AS last_check_in_date,
          streak_count AS current_streak
        FROM user_check_ins
        WHERE user_id = $1
        ORDER BY check_in_date DESC, check_in_id DESC
        LIMIT 1
      `,
        [userId],
      );

      const latest = latestResult.rows[0] ?? {
        last_check_in_date: null,
        current_streak: 0,
      };

      // 检查今天是否已签到
      const alreadyCheckedResult = await client.query<UserCheckInRow>(
        `
        SELECT
          check_in_id,
          user_id,
          TO_CHAR(check_in_date, 'YYYY-MM-DD') AS check_in_date,
          streak_count,
          base_points,
          bonus_points,
          total_points,
          created_at
        FROM user_check_ins
        WHERE user_id = $1 AND check_in_date = CURRENT_DATE
        LIMIT 1
      `,
        [userId],
      );

      if (alreadyCheckedResult.rows[0]) {
        const userResult = await client.query<UserRow>(
          "SELECT * FROM users WHERE user_id = $1 LIMIT 1",
          [userId],
        );
        await client.query("COMMIT");
        return {
          checkIn: alreadyCheckedResult.rows[0],
          points: Number(userResult.rows[0]?.points || 0),
          alreadyCheckedIn: true,
        };
      }

      // 计算连签天数
      let nextStreak = 1;
      if (latest.last_check_in_date) {
        const diffResult = await client.query<{ day_diff: number }>(
          `SELECT (CURRENT_DATE - $1::date)::int AS day_diff`,
          [latest.last_check_in_date],
        );
        const dayDiff = Number(diffResult.rows[0]?.day_diff ?? 0);
        if (dayDiff === 1) {
          nextStreak = Number(latest.current_streak || 0) + 1;
        }
      }

      // 计算积分奖励
      const streakBonusDays = Math.max(
        0,
        Math.min(nextStreak - 1, maxBonusStreakDays),
      );
      const bonusPoints = streakBonusDays * bonusPerStreakDay;
      const totalPoints = basePoints + bonusPoints;

      // 插入签到记录
      const checkInResult = await client.query<UserCheckInRow>(
        `
        INSERT INTO user_check_ins (user_id, check_in_date, streak_count, base_points, bonus_points, total_points)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
        RETURNING
          check_in_id, user_id, TO_CHAR(check_in_date, 'YYYY-MM-DD') AS check_in_date,
          streak_count, base_points, bonus_points, total_points, created_at
      `,
        [userId, nextStreak, basePoints, bonusPoints, totalPoints],
      );

      // 查询当前用户积分，用于计算变动后的余额
      const currentPointsResult = await client.query<{ points: number }>(
        "SELECT points FROM users WHERE user_id = $1 FOR UPDATE",
        [userId],
      );
      const currentPoints = Number(currentPointsResult.rows[0]?.points || 0);
      const pointsAfter = currentPoints + totalPoints;

      // 插入积分变动记录（触发器会自动将 users.points 更新为 points_after）
      await client.query(
        `INSERT INTO point_records (user_id, points_change, points_after, detail)
       VALUES ($1, $2, $3, '签到')`,
        [userId, totalPoints, pointsAfter],
      );

      // 获取更新后的用户信息（可选，用于返回准确的积分）
      const userResult = await client.query<UserRow>(
        "SELECT * FROM users WHERE user_id = $1 LIMIT 1",
        [userId],
      );

      await client.query("COMMIT");
      return {
        checkIn: checkInResult.rows[0],
        points: Number(userResult.rows[0]?.points || 0),
        alreadyCheckedIn: false,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  /** 生成并保存新的邮箱验证码 */
  async createVerificationCode(params: {
    email: string;
    code: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<EmailVerificationCodeRow> {
    const { email, code, expiresAt, ipAddress, userAgent } = params;
    const result = await pool.query<EmailVerificationCodeRow>(
      `
        INSERT INTO email_verification_codes (email, code, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [email, code, expiresAt, ipAddress || null, userAgent || null],
    );
    return result.rows[0];
  },

  /** 用户上传新作品 */
  async createUserWork(params: {
    userId: string;
    imagePath: string;
    description: string | null;
  }): Promise<UserWorkRow> {
    const { userId, imagePath, description } = params;
    const result = await pool.query<UserWorkRow>(
      `
        INSERT INTO user_works (user_id, image_path, description)
        VALUES ($1, $2, $3)
        RETURNING work_id, user_id, image_path, description, created_at, updated_at
      `,
      [userId, imagePath, description],
    );
    return result.rows[0];
  },

  /** 删除用户的特定作品 */
  async deleteUserWorkByIdAndUserId(
    workId: string,
    userId: string,
  ): Promise<UserWorkRow | null> {
    const result = await pool.query<UserWorkRow>(
      `
        DELETE FROM user_works
        WHERE work_id = $1 AND user_id = $2
        RETURNING work_id, user_id, image_path, description, created_at, updated_at
      `,
      [workId, userId],
    );
    return result.rows[0] ?? null;
  },

  /** 获取帖子下的所有评论 */
  async getCommentsByPostId(postId: string): Promise<CommentRow[]> {
    const result = await pool.query<CommentRow>(
      `
        SELECT
          c.comment_id, c.post_id, c.content, c.created_at, c.updated_at,
          u.user_id AS author_user_id, u.username AS author_username,
          u.role AS author_role, u.img_path AS author_img_path
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC, c.comment_id ASC
      `,
      [postId],
    );
    return result.rows;
  },

  /** 获取数据库服务器的当前日期（YYYY-MM-DD 格式） */
  async getDatabaseCurrentDate(): Promise<string> {
    const result = await pool.query<{ today_date: string }>(
      `SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS today_date`,
    );
    return result.rows[0]?.today_date || "";
  },

  /** 管理员后台查询订单（支持关键字模糊搜索） */
  async getOrdersForAdmin(
    keyword: string,
    limit: number = 100,
  ): Promise<AdminOrderRow[]> {
    const normalizedKeyword = keyword.trim();
    const wildcard = `%${normalizedKeyword}%`;
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 100;

    const sql = `
      SELECT
        o.order_id, o.user_id, u.username, o.product_name, o.customization_mode,
        o.configuration, o.pricing_lines, o.total_price, o.contact_name,
        o.contact_phone, o.shipping_address, o.order_note, o.design_image_path,
        o.design_description, o.status, o.created_at, o.updated_at
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      ${!normalizedKeyword ? "" : "WHERE o.order_id::TEXT ILIKE $1 OR u.username ILIKE $1 OR o.contact_name ILIKE $1 OR o.contact_phone ILIKE $1 OR o.status::TEXT ILIKE $1"}
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT ${!normalizedKeyword ? "$1" : "$2"}
    `;

    const params = !normalizedKeyword ? [safeLimit] : [wildcard, safeLimit];
    const result = await pool.query<AdminOrderRow>(sql, params);
    return result.rows;
  },

  /** 查询特定用户的订单列表（支持关键字搜索） */
  async getOrdersForUser(
    userId: string,
    keyword: string,
    limit: number = 100,
  ): Promise<AdminOrderRow[]> {
    const normalizedKeyword = keyword.trim();
    const wildcard = `%${normalizedKeyword}%`;
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 100;

    const sql = `
      SELECT
        o.order_id, o.user_id, u.username, o.product_name, o.customization_mode,
        o.configuration, o.pricing_lines, o.total_price, o.contact_name,
        o.contact_phone, o.shipping_address, o.order_note, o.design_image_path,
        o.design_description, o.status, o.created_at, o.updated_at
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE o.user_id = $1
      ${!normalizedKeyword ? "" : "AND (o.order_id::TEXT ILIKE $2 OR o.product_name ILIKE $2 OR o.contact_name ILIKE $2 OR o.contact_phone ILIKE $2 OR o.status::TEXT ILIKE $2)"}
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT ${!normalizedKeyword ? "$2" : "$3"}
    `;

    const params = !normalizedKeyword
      ? [userId, safeLimit]
      : [userId, wildcard, safeLimit];
    const result = await pool.query<AdminOrderRow>(sql, params);
    return result.rows;
  },
  /**获取积分记录(限50条) */
  async getPointRecordsByUserId(
    userId: string,
    limit: number = 50,
  ): Promise<PointRecordRow[]> {
    const result = await pool.query<PointRecordRow>(
      `SELECT record_id, points_change, points_after, detail, created_at
     FROM point_records
     WHERE user_id = $1
     ORDER BY created_at DESC, record_id DESC
     LIMIT $2`,
      [userId, limit],
    );
    return result.rows;
  },

  /** 获取单个帖子的详细信息及作者资料 */
  async getPostDetailById(postId: string): Promise<PostDetailRow | null> {
    const result = await pool.query<PostDetailRow>(
      `
        SELECT
          p.post_id, p.title, p.content, p.reply_count, p.access_level, p.preview_length, p.created_at, p.updated_at,
          u.user_id AS author_user_id, u.username AS author_username,
          u.role AS author_role, u.img_path AS author_img_path
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.post_id = $1
      `,
      [postId],
    );
    return result.rows[0] ?? null;
  },

  /** 获取所有帖子列表及其作者信息（按创建时间倒序） */
  async getPostsWithAuthor(): Promise<PostRow[]> {
    const result = await pool.query<PostRow>(`
      SELECT
        p.post_id, p.title, p.content, p.reply_count,p.access_level,  p.created_at, p.updated_at,
        u.username AS author_username, u.role AS author_role, u.img_path AS author_img_path
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  },

  /** 查询最近一段时间内某个邮箱的验证码发送次数（用于频率限制） */
  async getRecentVerificationAttempts(
    email: string,
    minutes: number = 10,
  ): Promise<number> {
    const result = await pool.query(
      `
        SELECT COUNT(*) as count FROM email_verification_codes
        WHERE email = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'
      `,
      [email],
    );
    return parseInt(result.rows[0].count, 10);
  },

  /** 通过电子邮箱查找用户 */
  async getUserByEmail(email: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    return result.rows[0] ?? null;
  },

  /** 通过用户 ID 查找用户 */
  async getUserById(userId?: string): Promise<UserRow | null> {
    if (!userId) return null;
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ?? null;
  },

  /** 通过用户名查找用户 */
  async getUserByUsername(username: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE username = $1",
      [username],
    );
    return result.rows[0] ?? null;
  },

  /** 同时通过用户名和邮箱验证用户身份 */
  async getUserByUsernameAndEmail(
    username: string,
    email: string,
  ): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE username = $1 and email = $2",
      [username, email],
    );
    return result.rows[0] ?? null;
  },

  /** 查询用户当前的签到统计信息 */
  async getUserCheckInStatus(userId: string): Promise<UserCheckInStatusRow> {
    const result = await pool.query<UserCheckInStatusRow>(
      `
        SELECT
          TO_CHAR(check_in_date, 'YYYY-MM-DD') AS last_check_in_date,
          streak_count AS current_streak
        FROM user_check_ins
        WHERE user_id = $1
        ORDER BY check_in_date DESC, check_in_id DESC
        LIMIT 1
      `,
      [userId],
    );
    return result.rows[0] ?? { last_check_in_date: null, current_streak: 0 };
  },

  /** 获取用于主页展示的公开用户信息 */
  async getUserPublicProfileById(
    userId: string,
  ): Promise<UserPublicProfileRow | null> {
    const result = await pool.query<UserPublicProfileRow>(
      `
        SELECT user_id, username, role, img_path, bio, is_certified_designer, created_at
        FROM users
        WHERE user_id = $1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  },

  /** 管理员后台搜索用户（支持 ID、用户名、邮箱、角色模糊搜索） */
  async getUsersForAdmin(
    keyword: string,
    limit: number = 100,
  ): Promise<AdminUserRow[]> {
    const normalizedKeyword = keyword.trim();
    const wildcard = `%${normalizedKeyword}%`;
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 100;

    const sql = `
      SELECT user_id, username, email, role, img_path, bio, created_at, updated_at
      FROM users
      ${!normalizedKeyword ? "" : "WHERE CAST(user_id AS TEXT) ILIKE $1 OR username ILIKE $1 OR email ILIKE $1 OR role::TEXT ILIKE $1"}
      ORDER BY created_at DESC, user_id DESC
      LIMIT ${!normalizedKeyword ? "$1" : "$2"}
    `;
    const params = !normalizedKeyword ? [safeLimit] : [wildcard, safeLimit];
    const result = await pool.query<AdminUserRow>(sql, params);
    return result.rows;
  },

  /** 获取指定用户的所有作品记录 */
  async getUserWorksByUserId(userId: string): Promise<UserWorkRow[]> {
    const result = await pool.query<UserWorkRow>(
      `
        SELECT work_id, user_id, image_path, description, created_at, updated_at
        FROM user_works
        WHERE user_id = $1
        ORDER BY created_at DESC, work_id DESC
      `,
      [userId],
    );
    return result.rows;
  },

  /** 获取一个尚未被使用且未过期的特定邮箱验证码 */
  async getValidVerificationCode(
    email: string,
    code: string,
  ): Promise<EmailVerificationCodeRow | null> {
    const result = await pool.query<EmailVerificationCodeRow>(
      `
        SELECT * FROM email_verification_codes
        WHERE email = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP AND used = FALSE
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [email, code],
    );
    return result.rows[0] ?? null;
  },

  /** 将邮箱验证码标记为已使用 */
  async markVerificationCodeAsUsed(id: string): Promise<void> {
    await pool.query(
      "UPDATE email_verification_codes SET used = TRUE WHERE id = $1",
      [id],
    );
  },

  /** 兑换奖品（事务处理） */
  async redeemReward(params: {
    userId: string;
    rewardId: string;
    rewardName: string;
    pointsRequired: number;
    contactName: string;
    contactPhone: string;
    shippingAddress: string;
    note: string | null;
  }): Promise<{
    redemption_id: number;
    points_after: number;
    redeemed_at: string;
  }> {
    const {
      userId,
      rewardId,
      rewardName,
      pointsRequired,
      contactName,
      contactPhone,
      shippingAddress,
      note,
    } = params;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. 锁定用户积分行并获取当前积分
      const userRes = await client.query<{ points: number }>(
        `SELECT points FROM users WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const currentPoints = Number(userRes.rows[0]?.points ?? 0);
      if (currentPoints < pointsRequired) {
        throw new Error("积分不足");
      }

      // 2. 扣除积分（通过 point_records 触发同步）
      const pointsAfter = currentPoints - pointsRequired;
      await client.query(
        `INSERT INTO point_records (user_id, points_change, points_after, detail)
       VALUES ($1, $2, $3, $4)`,
        [userId, -pointsRequired, pointsAfter, `兑换奖品：${rewardName}`],
      );

      // 3. 创建兑换记录
      const result = await client.query<{
        redemption_id: number;
        redeemed_at: string;
      }>(
        `INSERT INTO redemptions
         (user_id, reward_id, reward_name, points_deducted, contact_name, contact_phone, shipping_address, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING redemption_id, redeemed_at`,
        [
          userId,
          rewardId,
          rewardName,
          pointsRequired,
          contactName,
          contactPhone,
          shippingAddress,
          note || null,
        ],
      );

      await client.query("COMMIT");

      return {
        redemption_id: result.rows[0].redemption_id,
        points_after: pointsAfter,
        redeemed_at: result.rows[0].redeemed_at,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  /** 更新订单状态（管理员操作） */
  async updateOrderStatus(
    orderId: string,
    status: AdminOrderRow["status"],
  ): Promise<AdminOrderRow | null> {
    const result = await pool.query<AdminOrderRow>(
      `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE order_id = $2
      RETURNING
        order_id, user_id,
        (SELECT username FROM users WHERE user_id = orders.user_id) as username,
        product_name, customization_mode, configuration, pricing_lines, total_price,
        contact_name, contact_phone, shipping_address, order_note,
        design_image_path, design_description, status, created_at, updated_at
    `,
      [status, orderId],
    );
    return result.rows[0] || null;
  },

  /** 更新用户的个人简介（Bio） */
  async updateUserBioById(
    userId: string,
    bio: string | null,
  ): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "UPDATE users SET bio = $1 WHERE user_id = $2 RETURNING *",
      [bio, userId],
    );
    return result.rows[0] ?? null;
  },

  /** 更新用户的头像图片路径 */
  async updateUserImagePathById(
    userId: string,
    imgPath: string | null,
  ): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "UPDATE users SET img_path = $1 WHERE user_id = $2 RETURNING *",
      [imgPath, userId],
    );
    return result.rows[0] ?? null;
  },

  /** 通过用户名更新用户的登录密码（哈希值） */
  async updateUserPasswordByUsername(
    username: string,
    passwordHash: string,
  ): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING *",
      [passwordHash, username],
    );
    return result.rows[0] ?? null;
  },
};
