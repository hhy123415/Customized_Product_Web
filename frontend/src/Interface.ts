export interface User_info {
  username: string;
  email: string;
  role: string;
  img_path?: string | null;
}

// 定义帖子的类型，与后端数据结构对应
export interface Post {
  post_id: string; // post_id 通常是字符串或数字，这里假设为字符串
  title: string;
  content: string;
  reply_count: number;
  created_at: string; // 日期时间通常作为字符串返回
  updated_at: string;
  author_username: string;
}
