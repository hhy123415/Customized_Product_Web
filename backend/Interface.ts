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

export interface UserRow {
  user_id?: string;
  user_name: string;
  password: string;
  email: string;
  is_admin: boolean;
}
