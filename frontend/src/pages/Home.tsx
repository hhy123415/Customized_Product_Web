import styles from "../css/Home.module.css";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";

function Home() {
  const { auth } = useAuth();

  return (
    <div className={styles.container}>
      {/* 未登录状态*/}
      {!auth.isLoggedIn && (
        <div className={styles.card}>
          <h1 className={styles.title}>请先登录以正常使用功能</h1>
          <p className={styles.subtitle}>登录后您可以访问完整的功能和服务</p>
          <div className={styles.actionArea}>
            <Link to="/login" className={styles.loginBtn}>
              立即登录
            </Link>
          </div>
        </div>
      )}
      {/* 已登录状态 */}
      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <div className={styles.header}>
            <p className={styles.title}>请选择您要执行的操作</p>
          </div>

          <div className={styles.grid}>
            {/* 管理员功能区 */}
            {auth.role === "admin" && (
              <>
                <Link
                  to="/query"
                  className={`${styles.menuBtn} ${styles.adminTheme}`}
                >
                  <span className={styles.icon}>🔍</span>
                  查询信息
                </Link>
                <Link
                  to="/audit"
                  className={`${styles.menuBtn} ${styles.adminTheme}`}
                >
                  <span className={styles.icon}>📋</span>
                  审核发布
                </Link>
                {/* 更多管理员专属功能 */}
                <Link
                  to="/manage-users"
                  className={`${styles.menuBtn} ${styles.adminTheme}`}
                >
                  <span className={styles.icon}>👥</span>
                  管理用户
                </Link>
              </>
            )}

            {/* 企业用户功能区 */}
            {auth.role === "enterprise" && (
              <>
                <Link
                  to="/enterprise/new-application"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`} // 假设有 enterpriseTheme
                >
                  <span className={styles.icon}>➕</span>
                  提交企业酒店申请
                </Link>
                <Link
                  to="/enterprise/my-applications"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>⏳</span>
                  查看我的企业申请
                </Link>
                <Link
                  to="/enterprise/manage-hotels"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>🏢</span>
                  管理企业酒店列表
                </Link>
                {/* 更多企业用户专属功能 */}
                <Link
                  to="/enterprise/reports"
                  className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
                >
                  <span className={styles.icon}>📊</span>
                  数据报告
                </Link>
              </>
            )}

            {/* 普通用户功能区  */}
            {auth.role === "regular" && (
              <>
                <Link
                  to="/new-request"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <span className={styles.icon}>➕</span>
                  新的酒店申请
                </Link>
                <Link
                  to="/my-pending"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <span className={styles.icon}>⏳</span>
                  我的申请
                </Link>
                <Link
                  to="/my-hotel"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <span className={styles.icon}>⚙️</span>
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