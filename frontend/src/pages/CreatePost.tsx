import styles from "../css/CreativeSquare.module.css";
import loginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import api from "../api/axios";

function CreatePostPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setSubmitError(response.data.message || "发布失败，请稍后再试。");
        return;
      }

      navigate("/CreativeSquare");
    } catch (err) {
      console.error("Failed to create post:", err);
      setSubmitError("发布失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={loginStyle.container}>
      {!auth.isLoggedIn && (
        <div className={loginStyle.card}>
          <h1 className={loginStyle.title}>请先登录后再发布帖子</h1>
          <div className={loginStyle.actionArea}>
            <Link to="/login" className={loginStyle.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}

      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <div className={styles.headerRow}>
            <h2 className={styles.sectionTitle}>发布帖子</h2>
            <Link to="/CreativeSquare" className={styles.publishEntry}>
              返回广场
            </Link>
          </div>

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
              rows={8}
            />
            {submitError && <p className={styles.errorMessage}>{submitError}</p>}
            <button className={styles.primaryBtn} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "发布中..." : "发布帖子"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default CreatePostPage;
