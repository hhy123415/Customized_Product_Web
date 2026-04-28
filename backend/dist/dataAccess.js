"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
/** 数据库连接池配置 */
const pool = new pg_1.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "", 10),
});
exports.db = {
    /** 用户取消订单（仅限已提交或处理中的订单） */
    async cancelOrderForUser(orderId, userId) {
        const result = await pool.query(`
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
    `, [orderId, userId]);
        return result.rows[0] || null;
    },
    /** 检查数据库连接是否正常 */
    async checkConnection() {
        const client = await pool.connect();
        client.release();
    },
    /** 定期清理过期的邮箱验证码记录 */
    async cleanupExpiredVerificationCodes() {
        await pool.query("DELETE FROM email_verification_codes WHERE expires_at < CURRENT_TIMESTAMP");
    },
    /** 为帖子创建新评论，并返回包含作者信息的评论记录 */
    async createComment(params) {
        const { postId, userId, content } = params;
        const result = await pool.query(`
        INSERT INTO comments (post_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING comment_id, post_id, content, created_at, updated_at
      `, [postId, userId, content]);
        const inserted = result.rows[0];
        const commentWithAuthor = await pool.query(`
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
      `, [inserted.comment_id]);
        return commentWithAuthor.rows[0];
    },
    /** 创建新的球杆定制订单 */
    async createPoolCueOrder(params) {
        const { userId, productName, configuration, pricingLines, totalPrice, contactName, contactPhone, shippingAddress, orderNote, customizationMode, designImagePath, designDescription, } = params;
        const result = await pool.query(`
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
      `, [
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
        ]);
        return result.rows[0];
    },
    /** 发布新帖子 */
    async createPost(params) {
        const { userId, title, content } = params;
        const result = await pool.query(`
        INSERT INTO posts (user_id, title, content)
        VALUES ($1, $2, $3)
        RETURNING post_id, title, content, reply_count, created_at, updated_at
      `, [userId, title, content]);
        const inserted = result.rows[0];
        const postWithAuthor = await pool.query(`
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
      `, [inserted.post_id]);
        return postWithAuthor.rows[0];
    },
    /** 创建新用户记录 */
    async createUser(params) {
        const { username, passwordHash, email, role } = params;
        await pool.query("INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)", [username, passwordHash, email, role]);
    },
    /** 执行用户签到逻辑（包含事务处理、连续签到天数计算及积分发放） */
    async createUserCheckIn(params) {
        const { userId, basePoints, bonusPerStreakDay, maxBonusStreakDays } = params;
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            // 查询最近一次签到记录
            const latestResult = await client.query(`
          SELECT
            TO_CHAR(check_in_date, 'YYYY-MM-DD') AS last_check_in_date,
            streak_count AS current_streak
          FROM user_check_ins
          WHERE user_id = $1
          ORDER BY check_in_date DESC, check_in_id DESC
          LIMIT 1
        `, [userId]);
            const latest = latestResult.rows[0] ?? {
                last_check_in_date: null,
                current_streak: 0,
            };
            // 检查今天是否已签到
            const alreadyCheckedResult = await client.query(`
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
        `, [userId]);
            if (alreadyCheckedResult.rows[0]) {
                const userResult = await client.query("SELECT * FROM users WHERE user_id = $1 LIMIT 1", [userId]);
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
                const diffResult = await client.query(`SELECT (CURRENT_DATE - $1::date)::int AS day_diff`, [latest.last_check_in_date]);
                const dayDiff = Number(diffResult.rows[0]?.day_diff ?? 0);
                if (dayDiff === 1) {
                    nextStreak = Number(latest.current_streak || 0) + 1;
                }
            }
            // 计算积分奖励
            const streakBonusDays = Math.max(0, Math.min(nextStreak - 1, maxBonusStreakDays));
            const bonusPoints = streakBonusDays * bonusPerStreakDay;
            const totalPoints = basePoints + bonusPoints;
            // 插入签到记录
            const checkInResult = await client.query(`
          INSERT INTO user_check_ins (user_id, check_in_date, streak_count, base_points, bonus_points, total_points)
          VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
          RETURNING
            check_in_id, user_id, TO_CHAR(check_in_date, 'YYYY-MM-DD') AS check_in_date,
            streak_count, base_points, bonus_points, total_points, created_at
        `, [userId, nextStreak, basePoints, bonusPoints, totalPoints]);
            // 更新用户总积分
            const userResult = await client.query(`
          UPDATE users
          SET points = COALESCE(points, 0) + $1
          WHERE user_id = $2
          RETURNING *
        `, [totalPoints, userId]);
            await client.query("COMMIT");
            return {
                checkIn: checkInResult.rows[0],
                points: Number(userResult.rows[0]?.points || 0),
                alreadyCheckedIn: false,
            };
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    },
    /** 生成并保存新的邮箱验证码 */
    async createVerificationCode(params) {
        const { email, code, expiresAt, ipAddress, userAgent } = params;
        const result = await pool.query(`
        INSERT INTO email_verification_codes (email, code, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [email, code, expiresAt, ipAddress || null, userAgent || null]);
        return result.rows[0];
    },
    /** 用户上传新作品 */
    async createUserWork(params) {
        const { userId, imagePath, description } = params;
        const result = await pool.query(`
        INSERT INTO user_works (user_id, image_path, description)
        VALUES ($1, $2, $3)
        RETURNING work_id, user_id, image_path, description, created_at, updated_at
      `, [userId, imagePath, description]);
        return result.rows[0];
    },
    /** 删除用户的特定作品 */
    async deleteUserWorkByIdAndUserId(workId, userId) {
        const result = await pool.query(`
        DELETE FROM user_works
        WHERE work_id = $1 AND user_id = $2
        RETURNING work_id, user_id, image_path, description, created_at, updated_at
      `, [workId, userId]);
        return result.rows[0] ?? null;
    },
    /** 获取帖子下的所有评论 */
    async getCommentsByPostId(postId) {
        const result = await pool.query(`
        SELECT
          c.comment_id, c.post_id, c.content, c.created_at, c.updated_at,
          u.user_id AS author_user_id, u.username AS author_username,
          u.role AS author_role, u.img_path AS author_img_path
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC, c.comment_id ASC
      `, [postId]);
        return result.rows;
    },
    /** 获取数据库服务器的当前日期（YYYY-MM-DD 格式） */
    async getDatabaseCurrentDate() {
        const result = await pool.query(`SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS today_date`);
        return result.rows[0]?.today_date || "";
    },
    /** 管理员后台查询订单（支持关键字模糊搜索） */
    async getOrdersForAdmin(keyword, limit = 100) {
        const normalizedKeyword = keyword.trim();
        const wildcard = `%${normalizedKeyword}%`;
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 100;
        const sql = `
      SELECT
        o.order_id, o.user_id, u.username, o.product_name, o.customization_mode,
        o.configuration, o.pricing_lines, o.total_price, o.contact_name,
        o.contact_phone, o.shipping_address, o.order_note, o.design_image_path,
        o.design_description, o.status, o.created_at, o.updated_at
      FROM pool_cue_orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      ${!normalizedKeyword ? "" : "WHERE o.order_id::TEXT ILIKE $1 OR u.username ILIKE $1 OR o.contact_name ILIKE $1 OR o.contact_phone ILIKE $1 OR o.status::TEXT ILIKE $1"}
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT ${!normalizedKeyword ? "$1" : "$2"}
    `;
        const params = !normalizedKeyword ? [safeLimit] : [wildcard, safeLimit];
        const result = await pool.query(sql, params);
        return result.rows;
    },
    /** 查询特定用户的订单列表（支持关键字搜索） */
    async getOrdersForUser(userId, keyword, limit = 100) {
        const normalizedKeyword = keyword.trim();
        const wildcard = `%${normalizedKeyword}%`;
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 100;
        const sql = `
      SELECT
        o.order_id, o.user_id, u.username, o.product_name, o.customization_mode,
        o.configuration, o.pricing_lines, o.total_price, o.contact_name,
        o.contact_phone, o.shipping_address, o.order_note, o.design_image_path,
        o.design_description, o.status, o.created_at, o.updated_at
      FROM pool_cue_orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE o.user_id = $1
      ${!normalizedKeyword ? "" : "AND (o.order_id::TEXT ILIKE $2 OR o.product_name ILIKE $2 OR o.contact_name ILIKE $2 OR o.contact_phone ILIKE $2 OR o.status::TEXT ILIKE $2)"}
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT ${!normalizedKeyword ? "$2" : "$3"}
    `;
        const params = !normalizedKeyword ? [userId, safeLimit] : [userId, wildcard, safeLimit];
        const result = await pool.query(sql, params);
        return result.rows;
    },
    /** 获取单个帖子的详细信息及作者资料 */
    async getPostDetailById(postId) {
        const result = await pool.query(`
        SELECT
          p.post_id, p.title, p.content, p.reply_count, p.created_at, p.updated_at,
          u.user_id AS author_user_id, u.username AS author_username,
          u.role AS author_role, u.img_path AS author_img_path
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.post_id = $1
      `, [postId]);
        return result.rows[0] ?? null;
    },
    /** 获取所有帖子列表及其作者信息（按创建时间倒序） */
    async getPostsWithAuthor() {
        const result = await pool.query(`
      SELECT
        p.post_id, p.title, p.content, p.reply_count, p.created_at, p.updated_at,
        u.username AS author_username, u.role AS author_role, u.img_path AS author_img_path
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      ORDER BY p.created_at DESC
    `);
        return result.rows;
    },
    /** 查询最近一段时间内某个邮箱的验证码发送次数（用于频率限制） */
    async getRecentVerificationAttempts(email, minutes = 10) {
        const result = await pool.query(`
        SELECT COUNT(*) as count FROM email_verification_codes
        WHERE email = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'
      `, [email]);
        return parseInt(result.rows[0].count, 10);
    },
    /** 通过电子邮箱查找用户 */
    async getUserByEmail(email) {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return result.rows[0] ?? null;
    },
    /** 通过用户 ID 查找用户 */
    async getUserById(userId) {
        if (!userId)
            return null;
        const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [userId]);
        return result.rows[0] ?? null;
    },
    /** 通过用户名查找用户 */
    async getUserByUsername(username) {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        return result.rows[0] ?? null;
    },
    /** 同时通过用户名和邮箱验证用户身份 */
    async getUserByUsernameAndEmail(username, email) {
        const result = await pool.query("SELECT * FROM users WHERE username = $1 and email = $2", [username, email]);
        return result.rows[0] ?? null;
    },
    /** 查询用户当前的签到统计信息 */
    async getUserCheckInStatus(userId) {
        const result = await pool.query(`
        SELECT
          TO_CHAR(check_in_date, 'YYYY-MM-DD') AS last_check_in_date,
          streak_count AS current_streak
        FROM user_check_ins
        WHERE user_id = $1
        ORDER BY check_in_date DESC, check_in_id DESC
        LIMIT 1
      `, [userId]);
        return result.rows[0] ?? { last_check_in_date: null, current_streak: 0 };
    },
    /** 获取用于主页展示的公开用户信息 */
    async getUserPublicProfileById(userId) {
        const result = await pool.query(`
        SELECT user_id, username, role, img_path, bio, is_certified_designer, created_at
        FROM users
        WHERE user_id = $1
      `, [userId]);
        return result.rows[0] ?? null;
    },
    /** 管理员后台搜索用户（支持 ID、用户名、邮箱、角色模糊搜索） */
    async getUsersForAdmin(keyword, limit = 100) {
        const normalizedKeyword = keyword.trim();
        const wildcard = `%${normalizedKeyword}%`;
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 100;
        const sql = `
      SELECT user_id, username, email, role, img_path, bio, created_at, updated_at
      FROM users
      ${!normalizedKeyword ? "" : "WHERE CAST(user_id AS TEXT) ILIKE $1 OR username ILIKE $1 OR email ILIKE $1 OR role::TEXT ILIKE $1"}
      ORDER BY created_at DESC, user_id DESC
      LIMIT ${!normalizedKeyword ? "$1" : "$2"}
    `;
        const params = !normalizedKeyword ? [safeLimit] : [wildcard, safeLimit];
        const result = await pool.query(sql, params);
        return result.rows;
    },
    /** 获取指定用户的所有作品记录 */
    async getUserWorksByUserId(userId) {
        const result = await pool.query(`
        SELECT work_id, user_id, image_path, description, created_at, updated_at
        FROM user_works
        WHERE user_id = $1
        ORDER BY created_at DESC, work_id DESC
      `, [userId]);
        return result.rows;
    },
    /** 获取一个尚未被使用且未过期的特定邮箱验证码 */
    async getValidVerificationCode(email, code) {
        const result = await pool.query(`
        SELECT * FROM email_verification_codes
        WHERE email = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP AND used = FALSE
        ORDER BY created_at DESC
        LIMIT 1
      `, [email, code]);
        return result.rows[0] ?? null;
    },
    /** 将邮箱验证码标记为已使用 */
    async markVerificationCodeAsUsed(id) {
        await pool.query("UPDATE email_verification_codes SET used = TRUE WHERE id = $1", [id]);
    },
    /** 更新订单状态（管理员操作） */
    async updateOrderStatus(orderId, status) {
        const result = await pool.query(`
      UPDATE pool_cue_orders
      SET status = $1, updated_at = NOW()
      WHERE order_id = $2
      RETURNING
        order_id, user_id,
        (SELECT username FROM users WHERE user_id = pool_cue_orders.user_id) as username,
        product_name, customization_mode, configuration, pricing_lines, total_price,
        contact_name, contact_phone, shipping_address, order_note,
        design_image_path, design_description, status, created_at, updated_at
    `, [status, orderId]);
        return result.rows[0] || null;
    },
    /** 更新用户的个人简介（Bio） */
    async updateUserBioById(userId, bio) {
        const result = await pool.query("UPDATE users SET bio = $1 WHERE user_id = $2 RETURNING *", [bio, userId]);
        return result.rows[0] ?? null;
    },
    /** 更新用户的头像图片路径 */
    async updateUserImagePathById(userId, imgPath) {
        const result = await pool.query("UPDATE users SET img_path = $1 WHERE user_id = $2 RETURNING *", [imgPath, userId]);
        return result.rows[0] ?? null;
    },
    /** 通过用户名更新用户的登录密码（哈希值） */
    async updateUserPasswordByUsername(username, passwordHash) {
        const result = await pool.query("UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING *", [passwordHash, username]);
        return result.rows[0] ?? null;
    },
};
