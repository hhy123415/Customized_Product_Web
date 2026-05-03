import styles from "../css/CreativeSquare.module.css";
import loginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import api from "../api/axios";
import MarkdownEditor from "../component/MarkdownEditor";

function CreatePostPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [accessLevel, setAccessLevel] = useState("public");
  const [pointsRequired, setPointsRequired] = useState(0);
  const [previewLength, setPreviewLength] = useState(150);
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

    // 前端额外校验：若选择积分解锁，积分必须 > 0
    if (accessLevel === "points" && pointsRequired <= 0) {
      setSubmitError("积分解锁需要设置大于 0 的积分数。");
      return;
    }
    if (previewLength < 0) {
      setSubmitError("预览长度不能为负数。");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await api.post("/posts", {
        title,
        content,
        access_level: accessLevel,
        points_required: pointsRequired,
        preview_length: previewLength,
      });
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

            <MarkdownEditor
              value={newPostContent}
              onChange={setNewPostContent}
              height={400}
            />

            {/* ========== 访问控制选项 ========== */}
            <div className={styles.accessControlGroup}>
              <h4 className={styles.accessControlTitle}>访问权限设置</h4>
              
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="accessLevel"
                    value="public"
                    checked={accessLevel === "public"}
                    onChange={(e) => setAccessLevel(e.target.value)}
                  />
                  公开（所有人可见）
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="accessLevel"
                    value="owner_admin"
                    checked={accessLevel === "owner_admin"}
                    onChange={(e) => setAccessLevel(e.target.value)}
                  />
                  仅帖主和管理员可见
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="accessLevel"
                    value="points"
                    checked={accessLevel === "points"}
                    onChange={(e) => setAccessLevel(e.target.value)}
                  />
                  积分解锁可见（暂未启用）
                </label>
              </div>

              {accessLevel === "points" && (
                <div className={styles.optionField}>
                  <label className={styles.fieldLabel}>
                    所需积分:
                    <input
                      className={styles.smallInput}
                      type="number"
                      min="1"
                      value={pointsRequired}
                      onChange={(e) => setPointsRequired(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}

              {(accessLevel === "owner_admin" || accessLevel === "points") && (
                <div className={styles.optionField}>
                  <label className={styles.fieldLabel}>
                    预览长度（字符数）:
                    <input
                      className={styles.smallInput}
                      type="number"
                      min="0"
                      max="5000"
                      value={previewLength}
                      onChange={(e) => setPreviewLength(Number(e.target.value))}
                    />
                  </label>
                  <span className={styles.fieldHint}>
                    设为 0 则完全不显示内容预览
                  </span>
                </div>
              )}
            </div>
            {/* ========== 访问控制结束 ========== */}

            {submitError && (
              <p className={styles.errorMessage}>{submitError}</p>
            )}
            <button
              className={styles.primaryBtn}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "发布中..." : "发布帖子"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default CreatePostPage;