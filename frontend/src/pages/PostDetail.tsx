import styles from "../css/PostDetail.module.css";
import loginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { Comment, PostDetail } from "../Interface";

const DEFAULT_AVATAR = "/default-avatar.png";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

function PostDetailPage() {
  const { auth } = useAuth();
  const { postId } = useParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPost = async () => {
    if (!postId) {
      setError("帖子不存在。");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get(`/posts/${postId}`);
      if (!response.data.success) {
        setError(response.data.message || "加载帖子失败。");
        return;
      }

      setPost(response.data.post as PostDetail);
      setComments(response.data.comments as Comment[]);
    } catch (err) {
      console.error("Failed to fetch post detail:", err);
      setError("无法加载帖子详情，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.isLoggedIn) return;
    fetchPost();
  }, [auth.isLoggedIn, postId]);

  const handleCreateComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!postId) return;

    const content = newComment.trim();
    if (!content) {
      setSubmitError("回复内容不能为空。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.post(`/posts/${postId}/comments`, { content });
      if (!response.data.success) {
        setSubmitError(response.data.message || "回帖失败，请稍后再试。");
        return;
      }

      setNewComment("");
      await fetchPost();
    } catch (err) {
      console.error("Failed to create comment:", err);
      setSubmitError("回帖失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={loginStyle.container}>
      {!auth.isLoggedIn && (
        <div className={loginStyle.card}>
          <h1 className={loginStyle.title}>请先登录后查看帖子详情</h1>
          <div className={loginStyle.actionArea}>
            <Link to="/login" className={loginStyle.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}

      {auth.isLoggedIn && (
        <div className={styles.pageCard}>
          <Link to="/CreativeSquare" className={styles.backLink}>
            &larr; 返回创意广场
          </Link>

          {isLoading && <p>正在加载帖子详情...</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}

          {!isLoading && !error && post && (
            <>
              <article className={styles.postBlock}>
                <h1 className={styles.postTitle}>{post.title}</h1>

                <div className={styles.authorRow}>
                  <img
                    src={post.author_img_path || DEFAULT_AVATAR}
                    alt={`${post.author_username} 的头像`}
                    className={styles.avatar}
                  />
                  <div>
                    <p className={styles.authorName}>{post.author_username}</p>
                    <p className={styles.meta}>发布时间: {formatDate(post.created_at)}</p>
                  </div>
                </div>

                <p className={styles.postContent}>{post.content}</p>
              </article>

              <section className={styles.replySection}>
                <h2>回复 ({comments.length})</h2>

                <form className={styles.replyForm} onSubmit={handleCreateComment}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={5}
                    placeholder="写下你的回复..."
                    className={styles.textarea}
                  />
                  {submitError && <p className={styles.errorMessage}>{submitError}</p>}
                  <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                    {isSubmitting ? "提交中..." : "提交回复"}
                  </button>
                </form>

                <div className={styles.floorList}>
                  {comments.length === 0 ? (
                    <p className={styles.emptyText}>还没有回复，来抢沙发吧。</p>
                  ) : (
                    comments.map((comment, index) => (
                      <article key={comment.comment_id} className={styles.floorCard}>
                        <div className={styles.floorHeader}>
                          <div className={styles.authorRow}>
                            <img
                              src={comment.author_img_path || DEFAULT_AVATAR}
                              alt={`${comment.author_username} 的头像`}
                              className={styles.avatar}
                            />
                            <div>
                              <p className={styles.authorName}>{comment.author_username}</p>
                              <p className={styles.meta}>{formatDate(comment.created_at)}</p>
                            </div>
                          </div>
                          <span className={styles.floorTag}>{index + 1} 楼</span>
                        </div>
                        <p className={styles.floorContent}>{comment.content}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PostDetailPage;
