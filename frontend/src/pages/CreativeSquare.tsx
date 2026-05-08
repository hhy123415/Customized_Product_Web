import styles from "../css/CreativeSquare.module.css";
import loginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";
import type { Post } from "../Interface";
import Pagination from "../component/Pagination";

// 默认头像路径，当用户未设置头像时使用
const DEFAULT_AVATAR = "/default-avatar.png";

/**
 * 将 ISO 日期字符串转换为本地化的中文时间格式
 * @param value - 日期字符串
 * @returns 格式化后的日期文本，若解析失败则返回原始值
 */
const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

/**
 * 根据用户角色返回对应的标签文本与 CSS 类名
 * @param role - 用户角色（可选）
 * @returns 包含显示文字和样式类名的对象
 */
const getRoleTag = (role?: string) => {
  switch (role) {
    case "admin":
      return { text: "管理员", className: styles.tagAdmin };
    default:
      return { text: "用户", className: styles.tagUser };
  }
};

/**
 * 移除 Markdown 中的图片、链接标记以及常见符号，用于生成纯文本预览
 * @param markdown - 原始 Markdown 内容
 * @returns 清理后的纯文本
 */
const stripMarkdown = (markdown: string): string => {
  return markdown
    .replace(/!\[.*?\]\(.*?\)/g, "") // 移除图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接只保留文字部分
    .replace(/[#*_~`>]/g, "") // 移除常见标记符
    .trim();
};

/**
 * 从 Markdown 文本中提取第一张图片的 URL
 * @param markdown - Markdown 字符串
 * @returns 第一张图片的 URL，若未找到则返回 null
 */
const getFirstImageUrl = (markdown: string): string | null => {
  const match = markdown.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : null;
};

/**
 * 创意广场主组件
 * 提供帖子列表展示、关键词搜索、分页浏览等功能
 */
function Square() {
  // 获取当前登录用户的认证信息
  const { auth } = useAuth();

  // 帖子列表数据
  const [posts, setPosts] = useState<Post[]>([]);
  // 加载状态标识
  const [isLoading, setIsLoading] = useState(true);
  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 搜索关键词（实际提交给后端的关键词）
  const [keyword, setKeyword] = useState("");
  // 搜索输入框的实时内容
  const [searchInput, setSearchInput] = useState("");

  // 当前页码
  const [page, setPage] = useState(1);
  // 总页数（由后端返回）
  const [totalPages, setTotalPages] = useState(1);
  // 每页显示的帖子数量（固定值）
  const limit = 9;

  /**
   * 从后端获取帖子列表，支持关键词搜索与分页
   */
  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // 请求帖子列表接口，传递 keyword、page、limit 参数
      const response = await api.get("/posts", {
        params: {
          keyword: keyword.trim(),
          page,
          limit,
        },
      });
      if (!response.data.success) {
        setError("获取帖子列表失败，请稍后再试。");
        return;
      }
      // 更新帖子数据与分页信息
      setPosts(response.data.posts);
      setTotalPages(response.data.pagination.totalPages);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setError("无法加载帖子列表，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  };

  // 当登录状态、关键词或页码变化时重新拉取帖子数据
  useEffect(() => {
    if (!auth.isLoggedIn) return;
    fetchPosts();
  }, [auth.isLoggedIn, keyword, page]);

  return (
    <div className={loginStyle.container}>
      {/* 未登录状态的提示卡片 */}
      {!auth.isLoggedIn && (
        <div className={loginStyle.card}>
          <h1 className={loginStyle.title}>请先登录后再进入创意广场</h1>
          <p className={loginStyle.subtitle}>
            登录后即可发布、浏览与评论帖子。
          </p>
          <div className={loginStyle.actionArea}>
            <Link to="/login" className={loginStyle.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}

      {/* 登录后的主界面 */}
      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          {/* 头部：标题与发布入口 */}
          <div className={styles.headerRow}>
            <h2 className={styles.sectionTitle}>创意广场</h2>
            <Link to="/posts/create" className={styles.publishEntry}>
              <span className={styles.publishIcon} aria-hidden="true">+</span>
              发布帖子
            </Link>
          </div>

          {/* 搜索表单：输入关键词后回车或点击搜索按钮 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setKeyword(searchInput); // 提交搜索关键词
              setPage(1); // 重置到第一页
            }}
            className={styles.searchForm}
          >
            <input
              type="text"
              placeholder="搜索帖子标题或内容..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchButton}>
              搜索
            </button>
            {/* 有关键词时显示“清除”按钮，清空搜索并重置页码 */}
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setKeyword("");
                  setPage(1);
                }}
                className={styles.clearButton}
              >
                清除
              </button>
            )}
          </form>

          <h3 className={styles.listTitle}>最新帖子</h3>

          {/* 加载与错误状态提示 */}
          {isLoading && <p>正在加载帖子...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}

          {/* 帖子列表 */}
          {!isLoading && !error && (
            <div className={styles.postsGrid}>
              {posts.length === 0 ? (
                <p>目前还没有帖子，快来发布第一条吧。</p>
              ) : (
                posts.map((post) => {
                  // 提取帖子中的第一张图片作为封面
                  const cover = getFirstImageUrl(post.content);
                  return (
                    <Link
                      to={`/posts/${post.post_id}`}
                      key={post.post_id}
                      className={styles.postCard}
                    >
                      {/* 帖子标题及访问等级标识 */}
                      <h4 className={styles.postTitle}>
                        {post.title}
                        {post.access_level &&
                          post.access_level !== "public" && (
                            <span style={{ marginLeft: "6px", fontSize: "0.9em" }}>
                              🔒
                            </span>
                          )}
                      </h4>

                      {/* 作者信息：头像、用户名、角色标签 */}
                      <div className={styles.authorRow}>
                        <img
                          src={post.author_img_path || DEFAULT_AVATAR}
                          alt={`${post.author_username} 的头像`}
                          className={styles.avatar}
                        />
                        <span>{post.author_username}</span>
                        <span
                          className={`${styles.roleTag} ${getRoleTag(post.author_role).className}`}
                        >
                          {getRoleTag(post.author_role).text}
                        </span>
                      </div>

                      {/* 发布时间与回复数 */}
                      <p className={styles.postMeta}>
                        发布时间: {formatDate(post.created_at)} | 回复:{" "}
                        {post.reply_count}
                      </p>

                      {/* 内容预览（去除 Markdown 后截取前 150 个字符） */}
                      <p className={styles.postContentPreview}>
                        {stripMarkdown(post.content).substring(0, 150)}
                        {stripMarkdown(post.content).length > 150 ? "..." : ""}
                      </p>

                      {/* 文章封面图片（若存在） */}
                      {cover && (
                        <img src={cover} alt="" className={styles.postCover} />
                      )}

                      <span className={styles.readMore}>查看详情</span>
                    </Link>
                  );
                })
              )}
            </div>
          )}

          {/* 分页组件：仅当总页数大于 1 时显示 */}
          {!isLoading && !error && totalPages > 1 && (
            <Pagination
              current={page}
              total={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default Square;