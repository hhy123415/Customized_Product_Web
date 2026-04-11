import styles from "../css/Home.module.css";
import LoginStyle from "../css/LoginTip.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";

function Home() {
  const { auth } = useAuth();

  return (
    <div className={LoginStyle.container}>
      {!auth.isLoggedIn && (
        <div className={LoginStyle.card}>
          <h1 className={LoginStyle.title}>请先登录以正常使用功能</h1>
          <p className={LoginStyle.subtitle}>登录后您可以访问完整功能和服务</p>
          <div className={LoginStyle.actionArea}>
            <Link to="/login" className={LoginStyle.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}

      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <div className={styles.header}>
            <p className={styles.title}>请选择您要执行的操作</p>
          </div>

          <div className={styles.grid}>
            {auth.role === "admin" && (
              <Link
                to="/admin/user-query"
                className={`${styles.menuBtn} ${styles.adminTheme}`}
              >
                <span className={styles.icon}>🔎</span>
                查询用户信息
              </Link>
            )}

            {auth.role === "enterprise" && (
              <>
                <Link
                  to="/enterprise/new-application"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>➡</span>
                  提交企业酒店申请
                </Link>
                <Link
                  to="/enterprise/my-applications"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>🕒</span>
                  查看我的企业申请
                </Link>
                <Link
                  to="/enterprise/manage-hotels"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>🏨</span>
                  管理企业酒店列表
                </Link>
                <Link
                  to="/enterprise/reports"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>📊</span>
                  数据报告
                </Link>
              </>
            )}

            {auth.role === "regular" && (
              <>
                <Link
                  to="/new-request"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <span className={styles.icon}>➡</span>
                  新的酒店申请
                </Link>
                <Link
                  to="/my-pending"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <span className={styles.icon}>🕒</span>
                  我的申请
                </Link>
                <Link
                  to="/my-hotel"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <span className={styles.icon}>🏨</span>
                  管理我的酒店
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
