export interface User_info {
  user_id?: string;
  username: string;
  email: string;
  role: string;
  img_path?: string | null;
  bio?: string;
  is_certified_designer: boolean;
}

export interface UserWork {
  work_id: string;
  user_id: string;
  image_path: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckInStatus {
  can_check_in: boolean;
  last_check_in_date: string | null;
  current_streak: number;
  today_base_points: number;
  today_bonus_points: number;
  today_total_points: number;
}

type Role = "regular" | "admin";

export interface AdminUser {
  user_id: number;
  username: string;
  email: string;
  role: Role;
  img_path?: string | null;
  bio?: string | null;
  points?: number;
  is_certified_designer: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  post_id: string;
  user_id?: string; // 后端返回
  author_user_id?: string; // 后端兼容
  author_username: string;
  author_img_path: string | null;
  author_role?: string;
  title: string;
  content: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  access_level?: string; // 访问级别
  points_required?: number;
  preview_length?: number;
}

export interface PostDetail {
  post_id: string;
  title: string;
  content: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author_user_id: string;
  author_username: string;
  author_role: Role;
  author_img_path?: string | null;
  access_level?: string;
  content_locked?: boolean;
  points_required?: number;
  preview_length?: number;
}

export interface Comment {
  comment_id: string;
  post_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_user_id: string;
  author_username: string;
  author_role: Role;
  author_img_path?: string | null;
}

export interface AdminOrder {
  order_id: string;
  user_id: string;
  username: string | null;
  product_name: string;
  customization_mode: "preset" | "freeform";
  configuration: unknown;
  pricing_lines: unknown[];
  total_price: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  order_note: string | null;
  design_image_path: string | null;
  design_description: string | null;
  status: "submitted" | "quoted" | "processing" | "shipped" | "completed" | "cancelled";  // 增加 quoted
  created_at: string;
  updated_at: string;
  estimate_note?: string; 
  estimated_at?: string;
}

export interface PointRecordRow {
  record_id: number;
  user_id: number;
  points_change: number;
  points_after: number;
  detail: string;
  created_at: string;
}
