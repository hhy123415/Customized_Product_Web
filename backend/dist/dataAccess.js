"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "", 10),
});
exports.db = {
    async checkConnection() {
        const client = await pool.connect();
        client.release();
    },
    async getUserById(userId) {
        if (!userId)
            return null;
        const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [userId]);
        return result.rows[0] ?? null;
    },
    async getUserByUsername(username) {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        return result.rows[0] ?? null;
    },
    async getUserByEmail(email) {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return result.rows[0] ?? null;
    },
    async getUserByUsernameAndEmail(username, email) {
        const result = await pool.query("SELECT * FROM users WHERE username = $1 and email = $2", [username, email]);
        return result.rows[0] ?? null;
    },
    async createUser(params) {
        const { username, passwordHash, email, role } = params;
        await pool.query("INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)", [username, passwordHash, email, role]);
    },
    async updateUserPasswordByUsername(username, passwordHash) {
        const result = await pool.query("UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING *", [passwordHash, username]);
        return result.rows[0] ?? null;
    },
    async updateUserImagePathById(userId, imgPath) {
        const result = await pool.query("UPDATE users SET img_path = $1 WHERE user_id = $2 RETURNING *", [imgPath, userId]);
        return result.rows[0] ?? null;
    },
    async getPostsWithAuthor() {
        const result = await pool.query(`
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
      ORDER BY p.created_at DESC
    `);
        return result.rows;
    },
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
    async getPostDetailById(postId) {
        const result = await pool.query(`
        SELECT
          p.post_id,
          p.title,
          p.content,
          p.reply_count,
          p.created_at,
          p.updated_at,
          u.user_id AS author_user_id,
          u.username AS author_username,
          u.img_path AS author_img_path
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        WHERE p.post_id = $1
      `, [postId]);
        return result.rows[0] ?? null;
    },
    async getCommentsByPostId(postId) {
        const result = await pool.query(`
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
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC, c.comment_id ASC
      `, [postId]);
        return result.rows;
    },
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
};
