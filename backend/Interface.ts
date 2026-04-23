type Role = "regular" | "enterprise" | "admin";

export interface UserRow {
  user_id?: string;
  username: string;
  password_hash: string;
  email: string;
  role: Role;
  img_path?: string | null;
  bio?: string | null;
  points?:number;
}

export interface UserPublicProfileRow {
  user_id: string;
  username: string;
  role: Role;
  img_path?: string | null;
  bio?: string | null;
  is_certified_designer: boolean;
  created_at: string;
}

export interface AdminUserRow {
  user_id: string;
  username: string;
  email: string;
  role: Role;
  img_path?: string | null;
  bio?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWorkRow {
  work_id: string;
  user_id: string;
  image_path: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostRow {
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

export interface PostDetailRow {
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

export interface CommentRow {
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

export interface EmailVerificationCodeRow {
  id: string;
  email: string;
  code: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
}

export type PoolCueCustomizationMode = "preset" | "freeform";

export interface PoolCuePresetOrderConfig {
  customizationMode: "preset";
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
}

export interface PoolCueFreeformOrderConfig {
  customizationMode: "freeform";
  designDescription: string;
  preferredText: string | null;
  referenceImagePath: string | null;
}

export type PoolCueOrderConfig =
  | PoolCuePresetOrderConfig
  | PoolCueFreeformOrderConfig;

export interface PoolCueOrderPriceLine {
  label: string;
  amount: number;
}

export type PoolCueOrderStatus =
  | "submitted"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

export interface PoolCueOrderRow {
  order_id: string;
  user_id: string;
  product_name: string;
  customization_mode: PoolCueCustomizationMode;
  configuration: PoolCueOrderConfig;
  pricing_lines: PoolCueOrderPriceLine[];
  total_price: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  order_note: string | null;
  design_image_path: string | null;
  design_description: string | null;
  status: PoolCueOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface AdminOrderRow {
  order_id: string;
  user_id: string;
  username: string | null;
  product_name: string;
  customization_mode: PoolCueCustomizationMode;
  configuration: unknown;
  pricing_lines: unknown[];
  total_price: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  order_note: string | null;
  design_image_path: string | null;
  design_description: string | null;
  status: "submitted" | "processing" | "shipped" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}
