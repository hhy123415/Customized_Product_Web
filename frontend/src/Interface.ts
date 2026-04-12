export interface User_info {
  user_id?: string;
  username: string;
  email: string;
  role: string;
  img_path?: string | null;
  bio?: string;
}

export interface UserWork {
  work_id: string;
  user_id: string;
  image_path: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

type Role = "regular" | "enterprise" | "admin";

export interface AdminUser {
  user_id: string;
  username: string;
  email: string;
  role: Role;
  img_path?: string | null;
  bio?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  post_id: string;
  title: string;
  content: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author_username: string;
  author_role: Role;
  author_img_path?: string | null;
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

export type ProductPageStatus = "draft" | "pending_review" | "approved" | "rejected";

export interface ProductPageParameter {
  id: string;
  name: string;
  type: "text" | "number" | "select";
  required: boolean;
  unit?: string | null;
  default_value?: string | null;
  options?: string[];
}

export interface ProductCustomizationPage {
  page_id: string;
  user_id: string;
  product_name: string;
  product_summary: string | null;
  parameters: ProductPageParameter[];
  status: ProductPageStatus;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  publisher_username?: string;
  reviewer_username?: string | null;
}
