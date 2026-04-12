import styles from "../css/Navbar.module.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const avatarSrc = auth.img_path || "/default-avatar.png";

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
          <li>
            <Link
              to="/CreativeSquare"
              className={
                location.pathname === "/CreativeSquare" ? styles.active : ""
              }
            >
              创意广场
            </Link>
          </li>
          <li>
            <Link
              to={
                auth.isLoggedIn && auth.role === "enterprise"
                  ? "/enterprise/product-pages/editor"
                  : "/product-customization"
              }
              className={
                location.pathname === "/product-customization" ||
                location.pathname === "/enterprise/product-pages/editor"
                  ? styles.active
                  : ""
              }
            >
              产品定制
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              className={
                location.pathname === "/about" ? styles.active : ""
              }
            >
              关于
            </Link>
          </li>
          {auth.isLoggedIn ? (
            <>
              <li className={styles["welcome-message"]}>
                欢迎回来，
                {auth.role === "admin"
                  ? "管理员"
                  : auth.role == "enterprise"
                    ? "企业用户"
                    : "普通用户"}{" "}
                <img
                  src={avatarSrc}
                  alt="用户头像"
                  className={styles["user-avatar"]}
                />
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
              <li>
                <Link
                  to="/my_account"
                  className={
                    location.pathname === "/my_account" ? styles.active : ""
                  }
                >
                  个人中心
                </Link>
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
