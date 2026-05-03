/* eslint-disable @typescript-eslint/no-unused-vars */
import styles from "../css/PostDetail.module.css";
import loginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { Comment, PostDetail } from "../Interface";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import MarkdownEditor from "../component/MarkdownEditor";

const DEFAULT_AVATAR = "/default-avatar.png";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

const getRoleTag = (role?: string) => {
  switch (role) {
    case "admin":
      return { text: "管理员", className: styles.tagAdmin };
    default:
      return { text: "用户", className: styles.tagUser };
  }
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

  // 锁定提示区域（使用 CSS 模块类）
  const LockedOverlay = () => (
    <div className={styles.lockedPreview}>
      <p className={styles.lockedTitle}>🔒 此帖子设置了访问限制</p>
      <p className={styles.lockedDesc}>
        仅帖主和管理员可以查看完整内容与回复。
        {post?.access_level === "points" && "（未来支持积分解锁）"}
      </p>
    </div>
  );

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
                  <Link
                    to={`/users/${post.author_user_id}`}
                    className={styles.userLink}
                  >
                    <img
                      src={post.author_img_path || DEFAULT_AVATAR}
                      alt={`${post.author_username} 的头像`}
                      className={styles.avatar}
                    />
                  </Link>
                  <div>
                    <Link
                      to={`/users/${post.author_user_id}`}
                      className={`${styles.authorName} ${styles.userLink}`}
                    >
                      {post.author_username}
                      <span
                        className={`${styles.roleTag} ${getRoleTag(post.author_role).className}`}
                      >
                        {getRoleTag(post.author_role).text}
                      </span>
                    </Link>
                    <p className={styles.meta}>
                      发布时间: {formatDate(post.created_at)}
                    </p>
                  </div>
                </div>

                {/* 帖子内容区域 */}
                <div className={styles.postContent}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    components={{
                      img: ({ node, ...props }) => (
                        <img {...props} loading="lazy" />
                      ),
                    }}
                  >
                    {post.content}
                  </ReactMarkdown>
                </div>

                {/* 若被锁定，在内容下方显示遮罩提示 */}
                {post.content_locked && <LockedOverlay />}
              </article>

              {/* 只有未锁定才显示回复模块 */}
              {!post.content_locked && (
                <section className={styles.replySection}>
                  <h2>回复 ({comments.length})</h2>

                  <div className={styles.floorList}>
                    {comments.length === 0 ? (
                      <p className={styles.emptyText}>还没有回复，来抢沙发吧。</p>
                    ) : (
                      comments.map((comment, index) => (
                        <article
                          key={comment.comment_id}
                          className={styles.floorCard}
                        >
                          <div className={styles.floorHeader}>
                            <div className={styles.authorRow}>
                              <Link
                                to={`/users/${comment.author_user_id}`}
                                className={styles.userLink}
                              >
                                <img
                                  src={comment.author_img_path || DEFAULT_AVATAR}
                                  alt={`${comment.author_username} 的头像`}
                                  className={styles.avatar}
                                />
                              </Link>
                              <div>
                                <Link
                                  to={`/users/${comment.author_user_id}`}
                                  className={`${styles.authorName} ${styles.userLink}`}
                                >
                                  {comment.author_username}
                                  <span
                                    className={`${styles.roleTag} ${getRoleTag(comment.author_role).className}`}
                                  >
                                    {getRoleTag(comment.author_role).text}
                                  </span>
                                </Link>
                                <p className={styles.meta}>
                                  {formatDate(comment.created_at)}
                                </p>
                              </div>
                            </div>
                            <span className={styles.floorTag}>
                              {index + 1} 楼
                            </span>
                          </div>
                          <div className={styles.floorContent}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeSanitize]}
                            >
                              {comment.content}
                            </ReactMarkdown>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <form
                    className={styles.replyForm}
                    onSubmit={handleCreateComment}
                  >
                    <MarkdownEditor
                      value={newComment}
                      onChange={setNewComment}
                      height={300}
                      placeholder="写下你的回复..."
                    />
                    {submitError && (
                      <p className={styles.errorMessage}>{submitError}</p>
                    )}
                    <button
                      type="submit"
                      className={styles.primaryBtn}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "提交中..." : "提交回复"}
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PostDetailPage;