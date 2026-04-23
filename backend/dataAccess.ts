import { randomUUID } from "crypto";
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
} from "./Interface";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "", 10),
});

export const db = {
  async checkConnection(): Promise<void> {
    const client = await pool.connect();
    client.release();
  },

  async getUserById(userId?: string): Promise<UserRow | null> {
    if (!userId) return null;
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ?? null;
  },

  async getUserByUsername(username: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE username = $1",
      [username],
    );
    return result.rows[0] ?? null;
  },

  async getUserByEmail(email: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    return result.rows[0] ?? null;
  },

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

  async createUser(params: {
    username: string;
    passwordHash: string;
    email: string;
    role: string;
  }): Promise<void> {
    const { username, passwordHash, email, role } = params;
    await pool.query(
      "INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)",
      [username, passwordHash, email, role],
    );
  },

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

  async getUserPublicProfileById(
    userId: string,
  ): Promise<UserPublicProfileRow | null> {
    const result = await pool.query<UserPublicProfileRow>(
      `
        SELECT
          user_id,
          username,
          role,
          img_path,
          bio,
          is_certified_designer,
          created_at
        FROM users
        WHERE user_id = $1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  },

  async getUsersForAdmin(
    keyword: string,
    limit: number = 100,
  ): Promise<AdminUserRow[]> {
    const normalizedKeyword = keyword.trim();
    const wildcard = `%${normalizedKeyword}%`;
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 100;

    if (!normalizedKeyword) {
      const result = await pool.query<AdminUserRow>(
        `
          SELECT
            user_id,
            username,
            email,
            role,
            img_path,
            bio,
            created_at,
            updated_at
          FROM users
          ORDER BY created_at DESC, user_id DESC
          LIMIT $1
        `,
        [safeLimit],
      );
      return result.rows;
    }

    const result = await pool.query<AdminUserRow>(
      `
        SELECT
          user_id,
          username,
          email,
          role,
          img_path,
          bio,
          created_at,
          updated_at
        FROM users
        WHERE
          CAST(user_id AS TEXT) ILIKE $1
          OR username ILIKE $1
          OR email ILIKE $1
          OR role::TEXT ILIKE $1
        ORDER BY created_at DESC, user_id DESC
        LIMIT $2
      `,
      [wildcard, safeLimit],
    );
    return result.rows;
  },

  async getOrdersForAdmin(
    keyword: string,
    limit: number = 100,
  ): Promise<AdminOrderRow[]> {
    const normalizedKeyword = keyword.trim();
    const wildcard = `%${normalizedKeyword}%`;
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 100;

    if (!normalizedKeyword) {
      const result = await pool.query<AdminOrderRow>(
        `
        SELECT
          o.order_id,
          o.user_id,
          u.username,
          o.product_name,
          o.customization_mode,
          o.configuration,
          o.pricing_lines,
          o.total_price,
          o.contact_name,
          o.contact_phone,
          o.shipping_address,
          o.order_note,
          o.design_image_path,
          o.design_description,
          o.status,
          o.created_at,
          o.updated_at
        FROM pool_cue_orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        ORDER BY o.created_at DESC, o.order_id DESC
        LIMIT $1
      `,
        [safeLimit],
      );
      return result.rows;
    }

    const result = await pool.query<AdminOrderRow>(
      `
      SELECT
        o.order_id,
        o.user_id,
        u.username,
        o.product_name,
        o.customization_mode,
        o.configuration,
        o.pricing_lines,
        o.total_price,
        o.contact_name,
        o.contact_phone,
        o.shipping_address,
        o.order_note,
        o.design_image_path,
        o.design_description,
        o.status,
        o.created_at,
        o.updated_at
      FROM pool_cue_orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE
        o.order_id::TEXT ILIKE $1
        OR u.username ILIKE $1
        OR o.contact_name ILIKE $1
        OR o.contact_phone ILIKE $1
        OR o.status::TEXT ILIKE $1
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT $2
    `,
      [wildcard, safeLimit],
    );
    return result.rows;
  },

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

    if (!normalizedKeyword) {
      const result = await pool.query<AdminOrderRow>(
        `
        SELECT
          o.order_id,
          o.user_id,
          u.username,
          o.product_name,
          o.customization_mode,
          o.configuration,
          o.pricing_lines,
          o.total_price,
          o.contact_name,
          o.contact_phone,
          o.shipping_address,
          o.order_note,
          o.design_image_path,
          o.design_description,
          o.status,
          o.created_at,
          o.updated_at
        FROM pool_cue_orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC, o.order_id DESC
        LIMIT $2
      `,
        [userId, safeLimit],
      );
      return result.rows;
    }

    const result = await pool.query<AdminOrderRow>(
      `
      SELECT
        o.order_id,
        o.user_id,
        u.username,
        o.product_name,
        o.customization_mode,
        o.configuration,
        o.pricing_lines,
        o.total_price,
        o.contact_name,
        o.contact_phone,
        o.shipping_address,
        o.order_note,
        o.design_image_path,
        o.design_description,
        o.status,
        o.created_at,
        o.updated_at
      FROM pool_cue_orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE
        o.user_id = $1
        AND (
          o.order_id::TEXT ILIKE $2
          OR o.product_name ILIKE $2
          OR o.contact_name ILIKE $2
          OR o.contact_phone ILIKE $2
          OR o.status::TEXT ILIKE $2
        )
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT $3
    `,
      [userId, wildcard, safeLimit],
    );
    return result.rows;
  },

  async updateOrderStatus(
    orderId: string,
    status: AdminOrderRow["status"],
  ): Promise<AdminOrderRow | null> {
    const result = await pool.query<AdminOrderRow>(
      `
      UPDATE pool_cue_orders
      SET status = $1, updated_at = NOW()
      WHERE order_id = $2
      RETURNING
        order_id,
        user_id,
        (SELECT username FROM users WHERE user_id = pool_cue_orders.user_id) as username,
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
      [status, orderId],
    );
    return result.rows[0] || null;
  },

  async cancelOrderForUser(
    orderId: string,
    userId: string,
  ): Promise<AdminOrderRow | null> {
    const result = await pool.query<AdminOrderRow>(
      `
      UPDATE pool_cue_orders
      SET status = 'cancelled', updated_at = NOW()
      WHERE
        order_id = $1
        AND user_id = $2
        AND status IN ('submitted', 'processing')
      RETURNING
        order_id,
        user_id,
        (SELECT username FROM users WHERE user_id = pool_cue_orders.user_id) as username,
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
        INSERT INTO pool_cue_orders (
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

  async getUserWorksByUserId(userId: string): Promise<UserWorkRow[]> {
    const result = await pool.query<UserWorkRow>(
      `
        SELECT
          work_id,
          user_id,
          image_path,
          description,
          created_at,
          updated_at
        FROM user_works
        WHERE user_id = $1
        ORDER BY created_at DESC, work_id DESC
      `,
      [userId],
    );
    return result.rows;
  },

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

  async getPostsWithAuthor(): Promise<PostRow[]> {
    const result = await pool.query<PostRow>(`
      SELECT
        p.post_id,
        p.title,
        p.content,
        p.reply_count,
        p.created_at,
        p.updated_at,
        u.username AS author_username,
        u.role AS author_role,
        u.img_path AS author_img_path
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  },

  async createPost(params: {
    userId: string;
    title: string;
    content: string;
  }): Promise<PostRow> {
    const { userId, title, content } = params;
    const result = await pool.query<PostRow>(
      `
        INSERT INTO posts (user_id, title, content)
        VALUES ($1, $2, $3)
        RETURNING post_id, title, content, reply_count, created_at, updated_at
      `,
      [userId, title, content],
    );

    const inserted = result.rows[0];
    const postWithAuthor = await pool.query<PostRow>(
      `
        SELECT
          p.post_id,
          p.title,
          p.content,
          p.reply_count,
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

  async getPostDetailById(postId: string): Promise<PostDetailRow | null> {
    const result = await pool.query<PostDetailRow>(
      `
        SELECT
          p.post_id,
          p.title,
          p.content,
          p.reply_count,
          p.created_at,
          p.updated_at,
          u.user_id AS author_user_id,
          u.username AS author_username,
          u.role AS author_role,
          u.img_path AS author_img_path
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.post_id = $1
      `,
      [postId],
    );

    return result.rows[0] ?? null;
  },

  async getCommentsByPostId(postId: string): Promise<CommentRow[]> {
    const result = await pool.query<CommentRow>(
      `
        SELECT
          c.comment_id,
          c.post_id,
          c.content,
          c.created_at,
          c.updated_at,
          u.user_id AS author_user_id,
          u.username AS author_username,
          u.role AS author_role,
          u.img_path AS author_img_path
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC, c.comment_id ASC
      `,
      [postId],
    );

    return result.rows;
  },

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

  // 邮箱验证码相关操作
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

  async markVerificationCodeAsUsed(id: string): Promise<void> {
    await pool.query(
      "UPDATE email_verification_codes SET used = TRUE WHERE id = $1",
      [id],
    );
  },

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

  async cleanupExpiredVerificationCodes(): Promise<void> {
    await pool.query(
      "DELETE FROM email_verification_codes WHERE expires_at < CURRENT_TIMESTAMP",
    );
  },
};
