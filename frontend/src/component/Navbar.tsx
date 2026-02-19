import styles from "../css/Navbar.module.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
    alert("已成功登出！");
  };

  return (
    <>
      <nav className={styles["navbar"]}>
        <div className={styles["nav-links"]}>
          <li>
            <Link
              to="/"
              className={location.pathname === "/" ? styles.active : ""}
            >
              首页
            </Link>
          </li>
          {auth.isLoggedIn ? (
            <>
              <li className={styles["welcome-message"]}>
                欢迎回来，{auth.isAdmin ? "管理员" : "用户"}
                <span style={{ fontWeight: "bold", color: "orange" }}>
                  {auth.username}
                </span>
                ！
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className={styles["logout-button"]}
                >
                  登出
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link
                to="/login"
                className={
                  location.pathname === "/login" ||
                  location.pathname === "/register"
                    ? styles.active
                    : ""
                }
              >
                登录
              </Link>
            </li>
          )}
        </div>
      </nav>
    </>
  );
}

export default NavBar;
