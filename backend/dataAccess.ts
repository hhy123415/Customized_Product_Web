import { randomUUID } from "crypto";
import { Pool } from "pg";
import type {
  AdminUserRow,
  CommentRow,
  ProductCustomizationPageRow,
  ProductPageParameterInput,
  ProductPageStatus,
  PostDetailRow,
  PostRow,
  UserPublicProfileRow,
  UserRow,
  UserWorkRow,
  EmailVerificationCodeRow,
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

  async getUserPublicProfileById(userId: string): Promise<UserPublicProfileRow | null> {
    const result = await pool.query<UserPublicProfileRow>(
      `
        SELECT
          user_id,
          username,
          role,
          img_path,
          bio,
          created_at
        FROM users
        WHERE user_id = $1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  },

  async getUsersForAdmin(keyword: string, limit: number = 100): Promise<AdminUserRow[]> {
    const normalizedKeyword = keyword.trim();
    const wildcard = `%${normalizedKeyword}%`;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 100;

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

  async getProductCustomizationPagesByUserId(
    userId: string,
    status?: ProductPageStatus,
  ): Promise<ProductCustomizationPageRow[]> {
    const params: string[] = [userId];
    const conditions = ["p.user_id = $1"];

    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    const result = await pool.query<ProductCustomizationPageRow>(
      `
        SELECT
          p.page_id,
          p.user_id,
          p.product_name,
          p.product_summary,
          p.parameters,
          p.status,
          p.review_comment,
          p.reviewed_by,
          p.reviewed_at,
          p.created_at,
          p.updated_at,
          u.username AS publisher_username,
          reviewer.username AS reviewer_username
        FROM product_customization_pages p
        JOIN users u ON u.user_id = p.user_id
        LEFT JOIN users reviewer ON reviewer.user_id = p.reviewed_by
        WHERE ${conditions.join(" AND ")}
        ORDER BY p.updated_at DESC, p.page_id DESC
      `,
      params,
    );
    return result.rows;
  },

  async getProductCustomizationPageById(pageId: string): Promise<ProductCustomizationPageRow | null> {
    const result = await pool.query<ProductCustomizationPageRow>(
      `
        SELECT
          p.page_id,
          p.user_id,
          p.product_name,
          p.product_summary,
          p.parameters,
          p.status,
          p.review_comment,
          p.reviewed_by,
          p.reviewed_at,
          p.created_at,
          p.updated_at,
          u.username AS publisher_username,
          reviewer.username AS reviewer_username
        FROM product_customization_pages p
        JOIN users u ON u.user_id = p.user_id
        LEFT JOIN users reviewer ON reviewer.user_id = p.reviewed_by
        WHERE p.page_id = $1
      `,
      [pageId],
    );
    return result.rows[0] ?? null;
  },

  async saveProductCustomizationPage(params: {
    pageId?: string;
    userId: string;
    productName: string;
    productSummary: string | null;
    parameters: ProductPageParameterInput[];
  }): Promise<ProductCustomizationPageRow> {
    const { pageId, userId, productName, productSummary, parameters } = params;
    const normalizedParameters = JSON.stringify(parameters);

    if (pageId) {
      const updated = await pool.query<{ page_id: string }>(
        `
          UPDATE product_customization_pages
          SET
            product_name = $1,
            product_summary = $2,
            parameters = $3::jsonb,
            status = 'draft',
            review_comment = NULL,
            reviewed_by = NULL,
            reviewed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE page_id = $4 AND user_id = $5
          RETURNING page_id
        `,
        [productName, productSummary, normalizedParameters, pageId, userId],
      );

      if (updated.rows[0]) {
        return (await this.getProductCustomizationPageById(updated.rows[0].page_id)) as ProductCustomizationPageRow;
      }
    }

    const createdPageId = pageId || randomUUID();
    await pool.query(
      `
        INSERT INTO product_customization_pages (
          page_id,
          user_id,
          product_name,
          product_summary,
          parameters,
          status
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, 'draft')
      `,
      [createdPageId, userId, productName, productSummary, normalizedParameters],
    );

    return (await this.getProductCustomizationPageById(createdPageId)) as ProductCustomizationPageRow;
  },

  async submitProductCustomizationPage(
    pageId: string,
    userId: string,
  ): Promise<ProductCustomizationPageRow | null> {
    const updated = await pool.query<{ page_id: string }>(
      `
        UPDATE product_customization_pages
        SET
          status = 'pending_review',
          review_comment = NULL,
          reviewed_by = NULL,
          reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE page_id = $1 AND user_id = $2
        RETURNING page_id
      `,
      [pageId, userId],
    );

    if (!updated.rows[0]) {
      return null;
    }

    return this.getProductCustomizationPageById(pageId);
  },

  async getProductCustomizationPagesForAdmin(
    status?: ProductPageStatus,
  ): Promise<ProductCustomizationPageRow[]> {
    const params: string[] = [];
    const whereClause = status ? "WHERE p.status = $1" : "";
    if (status) {
      params.push(status);
    }

    const result = await pool.query<ProductCustomizationPageRow>(
      `
        SELECT
          p.page_id,
          p.user_id,
          p.product_name,
          p.product_summary,
          p.parameters,
          p.status,
          p.review_comment,
          p.reviewed_by,
          p.reviewed_at,
          p.created_at,
          p.updated_at,
          u.username AS publisher_username,
          reviewer.username AS reviewer_username
        FROM product_customization_pages p
        JOIN users u ON u.user_id = p.user_id
        LEFT JOIN users reviewer ON reviewer.user_id = p.reviewed_by
        ${whereClause}
        ORDER BY
          CASE WHEN p.status = 'pending_review' THEN 0 ELSE 1 END,
          p.updated_at DESC,
          p.page_id DESC
      `,
      params,
    );
    return result.rows;
  },

  async reviewProductCustomizationPage(params: {
    pageId: string;
    reviewerId: string;
    status: Extract<ProductPageStatus, "approved" | "rejected">;
    reviewComment: string | null;
  }): Promise<ProductCustomizationPageRow | null> {
    const { pageId, reviewerId, status, reviewComment } = params;
    const updated = await pool.query<{ page_id: string }>(
      `
        UPDATE product_customization_pages
        SET
          status = $1,
          review_comment = $2,
          reviewed_by = $3,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE page_id = $4
        RETURNING page_id
      `,
      [status, reviewComment, reviewerId, pageId],
    );

    if (!updated.rows[0]) {
      return null;
    }

    return this.getProductCustomizationPageById(pageId);
  },

  async getPublicProductCustomizationPages(): Promise<ProductCustomizationPageRow[]> {
    const result = await pool.query<ProductCustomizationPageRow>(
      `
        SELECT
          p.page_id,
          p.user_id,
          p.product_name,
          p.product_summary,
          p.parameters,
          p.status,
          p.created_at,
          p.updated_at,
          u.username AS publisher_username
        FROM product_customization_pages p
        JOIN users u ON u.user_id = p.user_id
        WHERE p.status = 'approved'
        ORDER BY p.created_at DESC, p.page_id DESC
      `
    );
    return result.rows;
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

  async getValidVerificationCode(email: string, code: string): Promise<EmailVerificationCodeRow | null> {
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

  async getRecentVerificationAttempts(email: string, minutes: number = 10): Promise<number> {
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
    await pool.query("DELETE FROM email_verification_codes WHERE expires_at < CURRENT_TIMESTAMP");
  },
};
