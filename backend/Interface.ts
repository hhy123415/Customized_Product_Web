export interface HotelRow {
  id: number;
  name_zh: string;
  name_en: string;
  address: string;
  star_rating: number;
  operating_period: string;
  description?: string; // description 是可选的
  created_at: Date;
  updated_at: Date;
  active: boolean;
  user_id: number;
}

type Role = "regular" | "enterprise" | "admin";

export interface UserRow {
  user_id?: string;
  username: string;
  password_hash: string;
  email: string;
  role: Role;
  img_path?: string | null;
}

export interface PostRow {
  post_id: string;
  title: string;
  content: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author_username: string;
  author_img_path?: string | null;
}

export interface PostDetailRow {
  post_id: string;
  title: string;
  content: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author_user_id: string;
  author_username: string;
  author_img_path?: string | null;
}

export interface CommentRow {
  comment_id: string;
  post_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_user_id: string;
  author_username: string;
  author_img_path?: string | null;
}
