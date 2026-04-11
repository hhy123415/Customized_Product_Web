import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { AdminUser } from "../Interface";
import styles from "../css/AdminUserQuery.module.css";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

const roleTextMap: Record<AdminUser["role"], string> = {
  admin: "管理员",
  enterprise: "企业用户",
  regular: "普通用户",
};

function AdminUserQueryPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [inputKeyword, setInputKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>用户信息查询</h1>
        <p className={styles.subtitle}>支持按用户 ID、用户名、邮箱、角色进行搜索</p>

        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input
            type="text"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            placeholder="输入关键词后搜索"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchBtn} disabled={isLoading}>
            搜索
          </button>
          <button type="button" className={styles.resetBtn} onClick={handleReset} disabled={isLoading}>
            重置
          </button>
        </form>

        {isLoading && <p className={styles.tip}>正在查询用户信息...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!isLoading && !error && (
          <>
            <p className={styles.resultMeta}>
              {activeKeyword ? `关键词: ${activeKeyword} | ` : ""}
              共 {users.length} 条结果
            </p>
            <div className={styles.list}>
              {users.length === 0 ? (
                <p className={styles.empty}>没有匹配的用户。</p>
              ) : (
                users.map((user) => (
                  <article key={user.user_id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <p className={styles.name}>
                        {user.username}
                        <span className={styles.role}>{roleTextMap[user.role]}</span>
                      </p>
                      <p className={styles.meta}>ID: {user.user_id}</p>
                      <p className={styles.meta}>邮箱: {user.email}</p>
                      <p className={styles.meta}>创建时间: {formatDate(user.created_at)}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminUserQueryPage;
