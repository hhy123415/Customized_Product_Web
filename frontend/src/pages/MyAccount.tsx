import styles from "../css/MyAccount.module.css";
import type { User_info } from "../Interface";
import { useState, useEffect } from "react";
import api from "../api/axios";

// 定义角色名称的映射
const roleDisplayMap: { [key: string]: string } = {
  regular: "普通用户",
  enterprise: "企业用户",
  admin: "管理员",
  // 可以添加更多角色
};

function MyAccount() {
  const [userInfo, setUserInfo] = useState<User_info | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true); // 开始加载时设置 loading 为 true
        setError(null);   // 清除之前的错误信息

        const res = await api.get("/my_info");

        if (!res.data.success) {
          // 处理非成功响应，例如 401 Unauthorized, 403 Forbidden
          if (res.status === 401 || res.status === 403) {
            setError("您未登录或会话已过期，请重新登录。");
          } else {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
        }

        if (res.data.success) {
          setUserInfo(res.data.user);
        } else {
          // 后端返回 success: false 的情况
          setError(res.data.message || "获取用户信息失败。");
        }
      } catch (err) {
        console.error("Fetch user info error:", err);
        setError("网络错误或服务器无响应。");
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []); // 空依赖数组表示此 useEffect 只会在组件挂载时运行一次

  if (loading) {
    return (
      <div className={styles.container}>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>错误: {error}</p>
        <p>请确保您已登录。</p>
      </div>
    );
  }

  // userInfo 为 null 也是一种错误情况
  if (!userInfo) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>未能加载用户信息。</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2>我的账户</h2>
      <div className={styles.userInfoCard}>
        <p>
          <strong>用户名:</strong> {userInfo.username}
        </p>
        <p>
          <strong>用户邮箱:</strong> {userInfo.email}
        </p>
        <p>
          <strong>账号类型:</strong> {roleDisplayMap[userInfo.role]}
        </p>
      </div>
    </div>
  );
}


export default MyAccount;
