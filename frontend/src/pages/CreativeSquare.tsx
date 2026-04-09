import styles from "../css/CreativeSquare.module.css";
import loginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { Post } from "../Interface";

const DEFAULT_AVATAR = "/default-avatar.png";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

// 角色标签映射函数
const getRoleTag = (role?: string) => {
  switch (role) {
    case "admin":
      return { text: "管理员", className: styles.tagAdmin };
    case "enterprise":
      return { text: "企业", className: styles.tagEnterprise };
    default:
      return { text: "用户", className: styles.tagUser };
  }
};

function Square() {
  const { auth } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get("/posts");
      if (!response.data.success) {
        setError("获取帖子列表失败。请稍后再试。");
        return;
      }
      setPosts(response.data.posts as Post[]);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setError("无法加载帖子列表，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.isLoggedIn) return;
    fetchPosts();
  }, [auth.isLoggedIn]);

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newPostTitle.trim();
    const content = newPostContent.trim();

    if (!title || !content) {
      setSubmitError("标题和正文都不能为空。");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await api.post("/posts", { title, content });
      if (!response.data.success) {
        setSubmitError(response.data.message || "发帖失败，请稍后再试。");
        return;
      }

      setNewPostTitle("");
      setNewPostContent("");
      await fetchPosts();
    } catch (err) {
      console.error("Failed to create post:", err);
      setSubmitError("发帖失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={loginStyle.container}>
      {!auth.isLoggedIn && (
        <div className={loginStyle.card}>
          <h1 className={loginStyle.title}>请先登录后再进入创意广场</h1>
          <p className={loginStyle.subtitle}>登录后即可发帖、查看帖子详情和参与回帖。</p>
          <div className={loginStyle.actionArea}>
            <Link to="/login" className={loginStyle.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}

      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <h2 className={styles.sectionTitle}>创意广场</h2>

          <form className={styles.createPostForm} onSubmit={handleCreatePost}>
            <h3>发布新帖子</h3>
            <input
              className={styles.input}
              type="text"
              maxLength={255}
              placeholder="请输入帖子标题"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
            />
            <textarea
              className={styles.textarea}
              placeholder="请输入帖子内容"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={6}
            />
            {submitError && <p className={styles.errorMessage}>{submitError}</p>}
            <button className={styles.primaryBtn} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "发布中..." : "发布帖子"}
            </button>
          </form>

          <h3 className={styles.listTitle}>最新帖子</h3>

          {isLoading && <p>正在加载帖子...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}

          {!isLoading && !error && (
            <div className={styles.postsGrid}>
              {posts.length === 0 ? (
                <p>目前还没有任何帖子，来发布第一条吧。</p>
              ) : (
                posts.map((post) => (
                  <Link to={`/posts/${post.post_id}`} key={post.post_id} className={styles.postCard}>
                    <h4 className={styles.postTitle}>{post.title}</h4>

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

                    <p className={styles.postMeta}>
                      发布时间: {formatDate(post.created_at)} | 回复: {post.reply_count}
                    </p>

                    <p className={styles.postContentPreview}>
                      {post.content.substring(0, 150)}
                      {post.content.length > 150 ? "..." : ""}
                    </p>

                    <span className={styles.readMore}>查看详情 &raquo;</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Square;
