import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { AdminUser } from "../Interface";
import styles from "../css/AdminUserQuery.module.css";
import { AxiosError } from "axios";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

const roleTextMap: Record<AdminUser["role"], string> = {
  admin: "管理员",
  regular: "普通用户",
};

// 高亮关键词的辅助函数
const highlightText = (text: string, keyword: string) => {
  if (!keyword || !text) return text;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark
        key={index}
        style={{ backgroundColor: "#FFD700", padding: "0 2px" }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

function AdminUserQueryPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [inputKeyword, setInputKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 积分调整相关状态
  const [pointsModalUserId, setPointsModalUserId] = useState<number | null>(
    null,
  );
  const [pointsChange, setPointsChange] = useState<number>(0);
  const [pointsDetail, setPointsDetail] = useState("");
  const [pointsSubmitting, setPointsSubmitting] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [pointsSuccess, setPointsSuccess] = useState<string | null>(null);

  const fetchUsers = async (keyword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get("/admin/users", {
        params: { keyword },
      });

      if (!response.data.success) {
        setError(response.data.message || "查询失败，请稍后再试。");
        return;
      }

      setUsers((response.data.users || []) as AdminUser[]);
    } catch (err) {
      console.error("Failed to query users:", err);
      setError("无法查询用户信息，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers("");
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = inputKeyword.trim();
    setActiveKeyword(keyword);
    await fetchUsers(keyword);
  };

  const handleReset = async () => {
    setInputKeyword("");
    setActiveKeyword("");
    await fetchUsers("");
  };

  // 处理积分调整提交
  const handlePointsSubmit = async (userId: number | null) => {
    if (!userId) return;

    setPointsSubmitting(true);
    setPointsError(null);
    setPointsSuccess(null);

    try {
      const response = await api.post(`/admin/users/${userId}/points`, {
        points_change: pointsChange,
        detail: pointsDetail || undefined,
      });

      if (response.data.success) {
        setPointsSuccess(response.data.message);
        setPointsModalUserId(null);
        setPointsChange(0);
        setPointsDetail("");
        // 刷新用户列表
        await fetchUsers(activeKeyword);
      }
    } catch (err: unknown) {
      let message = "请稍后重试";

      if (err instanceof AxiosError) {
        message = err.response?.data?.message || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      setPointsError(message);
    } finally {
      setPointsSubmitting(false);
    }
  };

  // 处理设计师认证切换
  const handleCertificationToggle = async (
    userId: number,
    currentStatus: boolean,
  ) => {
    try {
      const response = await api.patch(`/admin/users/${userId}/certification`, {
        is_certified: !currentStatus,
      });

      if (response.data.success) {
        // 更新本地状态
        setUsers((prev) =>
          prev.map((user) =>
            user.user_id === userId
              ? { ...user, is_certified_designer: !currentStatus }
              : user,
          ),
        );
        alert(response.data.message);
      }
    } catch (err: unknown) {
      let message = "请稍后重试";

      if (err instanceof AxiosError) {
        message = err.response?.data?.message || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      alert(message);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>用户信息查询</h1>
        <p className={styles.subtitle}>
          支持按用户 ID、用户名、邮箱、角色进行搜索
        </p>

        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input
            type="text"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            placeholder="输入关键词后搜索"
            className={styles.searchInput}
          />
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={isLoading}
          >
            搜索
          </button>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
            disabled={isLoading}
          >
            重置
          </button>
        </form>

        {isLoading && <p className={styles.tip}>正在查询用户信息...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!isLoading && !error && (
          <>
            <p className={styles.resultMeta}>
              {activeKeyword ? `关键词: ${activeKeyword} | ` : ""}共{" "}
              {users.length} 条结果
            </p>
            <div className={styles.list}>
              {users.length === 0 ? (
                <p className={styles.empty}>没有匹配的用户。</p>
              ) : (
                users.map((user) => (
                  <article key={user.user_id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <p className={styles.name}>
                        {highlightText(user.username, activeKeyword)}
                        <span className={styles.role}>
                          {roleTextMap[user.role]}
                        </span>
                        {user.is_certified_designer && (
                          <span className={styles.certifiedBadge}>
                            认证设计师
                          </span>
                        )}
                      </p>
                      <p className={styles.meta}>
                        ID: {highlightText(String(user.user_id), activeKeyword)}
                      </p>
                      <p className={styles.meta}>
                        邮箱: {highlightText(user.email, activeKeyword)}
                      </p>
                      <p className={styles.meta}>
                        积分: <strong>{user.points || 0}</strong>
                      </p>
                      <p className={styles.meta}>
                        创建时间: {formatDate(user.created_at)}
                      </p>
                    </div>

                    {/* 新增操作按钮区 */}
                    <div className={styles.actions}>
                      {/* 积分调整按钮 */}
                      <button
                        className={styles.actionBtn}
                        onClick={() => setPointsModalUserId(user.user_id)}
                      >
                        调整积分
                      </button>

                      {/* 设计师认证按钮 */}
                      <button
                        className={`${styles.actionBtn} ${
                          user.is_certified_designer
                            ? styles.revokeBtn
                            : styles.grantBtn
                        }`}
                        onClick={() =>
                          handleCertificationToggle(
                            user.user_id,
                            user.is_certified_designer,
                          )
                        }
                      >
                        {user.is_certified_designer ? "撤销认证" : "授予认证"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {/* 积分调整弹窗 */}
        {pointsModalUserId && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>调整积分</h3>
              <div className={styles.formGroup}>
                <label>积分变动量（正数增加，负数扣除）：</label>
                <input
                  type="number"
                  value={pointsChange}
                  onChange={(e) => setPointsChange(Number(e.target.value))}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>变动原因：</label>
                <textarea
                  value={pointsDetail}
                  onChange={(e) => setPointsDetail(e.target.value)}
                  placeholder="可选，最多255字符"
                  maxLength={255}
                  className={styles.textarea}
                />
              </div>

              {pointsError && <p className={styles.error}>{pointsError}</p>}
              {pointsSuccess && (
                <p className={styles.success}>{pointsSuccess}</p>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.confirmBtn}
                  onClick={() => handlePointsSubmit(pointsModalUserId)}
                  disabled={pointsSubmitting || pointsChange === 0}
                >
                  {pointsSubmitting ? "处理中..." : "确认"}
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setPointsModalUserId(null)}
                  disabled={pointsSubmitting}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUserQueryPage;
