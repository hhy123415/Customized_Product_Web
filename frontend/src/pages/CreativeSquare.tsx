import styles from "../css/CreativeSquare.module.css";
import LoginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../api/axios";
import type { Post } from "../Interface";

function Square() {
  const { auth } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoggedIn) {
      const fetchPosts = async () => {
        try {
          setIsLoading(true); // 开始加载时设置 loading 为 true
          setError(null); // 清除之前的错误信息
          const response = await api.get("/posts");
          if(!response.data.success)
          {
            setError("获取服务器信息错误")
          }
          else{
            setPosts(response.data.posts);
          }
        } catch (err) {
          console.error("Failed to fetch posts:", err);
          setError("无法加载帖子列表，请稍后再试。");
        } finally {
          setIsLoading(false);
        }
      };

      fetchPosts();
    }
  }, [auth.isLoggedIn]); // 当登录状态改变时重新运行

  return (
    <div className={LoginStyle.container}>
      {/* 未登录状态*/}
      {!auth.isLoggedIn && (
        <div className={LoginStyle.card}>
          <h1 className={LoginStyle.title}>请先登录以正常使用功能</h1>
          <p className={LoginStyle.subtitle}>
            登录后您可以访问完整的功能和服务
          </p>
          <div className={LoginStyle.actionArea}>
            <Link to="/login" className={LoginStyle.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}
      {/* 已登录状态 */}
      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <h2 className={styles.sectionTitle}>最新帖子</h2>

          {isLoading && <p>正在加载帖子...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}

          {!isLoading && !error && (
            <div className={styles.postsGrid}>
              {posts.length === 0 ? (
                <p>目前还没有任何帖子。</p>
              ) : (
                posts.map((post) => (
                  <Link
                    to={`/posts/${post.post_id}`} // 跳转到详情页的抽象入口
                    key={post.post_id}
                    className={styles.postCard}
                  >
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <p className={styles.postMeta}>
                      作者: {post.author_username} | 回复: {post.reply_count}
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
