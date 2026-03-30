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

enum Role {
  "regular",
  "enterprise",
  "admin",
}

export interface UserRow {
  user_id?: string;
  username: string;
  password_hash: string;
  email: string;
  role: Role;
}

export interface PostRow {
  post_id: string;
  title: string;
  content: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author_username: string;
}
