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

type Role = "regular" | "admin";

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

export interface PoolCueOrder {
  order_id: string;
  user_id: string;
  product_name: string;
  configuration: {
    lengthCm: number;
    weightOz: number;
    tipDiameterMm: number;
    jointType: "stainless-steel" | "titanium";
    wrapType: "carbon-grip" | "genuine-leather" | "none";
    finishStyle:
      | "matte-carbon"
      | "gloss-carbon"
      | "stealth-black"
      | "ice-silver"
      | "ocean-blue"
      | "crimson-red";
    caseOption: "none" | "basic" | "pro";
    includeLaserEngraving: boolean;
  };
  pricing_lines: {
    label: string;
    amount: number;
  }[];
  total_price: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  order_note: string | null;
  status: "submitted";
  created_at: string;
  updated_at: string;
}
