import { Pool } from "pg";
import type { PostRow, UserRow } from "./Interface";

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

  async getPostsWithAuthor(): Promise<PostRow[]> {
    const result = await pool.query<PostRow>(`
      SELECT
        p.post_id,
        p.title,
        p.content,
        p.reply_count,
        p.created_at,
        p.updated_at,
        u.username AS author_username
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  },
};
