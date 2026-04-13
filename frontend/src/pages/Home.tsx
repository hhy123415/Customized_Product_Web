import { Link } from "react-router-dom";
import {
  Users,
  Sparkles,
  LayoutGrid,
  LogIn,
  LayoutDashboard,
} from "lucide-react";
import styles from "../css/Home.module.css";
import LoginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";

function Home() {
  const { auth } = useAuth();

  return (
    <div className={LoginStyle.container}>
      {!auth.isLoggedIn && (
        <div className={LoginStyle.card}>
          <h1 className={LoginStyle.title}>请先登录以继续使用平台功能</h1>
          <p className={LoginStyle.subtitle}>
            登录后可根据角色进入对应工作台。
          </p>
          <div className={LoginStyle.actionArea}>
            <Link to="/login" className={LoginStyle.loginBtn}>
              <LogIn
                size={18}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              立即登录
            </Link>
          </div>
        </div>
      )}

      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <div className={styles.header}>
            <p className={styles.title}>
              <LayoutDashboard
                size={24}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              欢迎使用工作台
            </p>
            <p className={styles.subtitle}>
              {auth.role === "admin"
                ? "管理员可在这里处理用户信息查询。"
                : "请选择你要使用的功能模块。"}
            </p>
          </div>

          <div className={styles.grid}>
            {auth.role === "admin" && (
              <>
                <Link
                  to="/admin/user-query"
                  className={`${styles.menuBtn} ${styles.adminTheme}`}
                >
                  <Users
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  查询用户信息
                </Link>
              </>
            )}

            {auth.role === "regular" && (
              <>
                <Link
                  to="/CreativeSquare"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <Sparkles
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  创意广场
                </Link>
                <Link
                  to="/product-customization"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <LayoutGrid
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  浏览产品定制示例
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
