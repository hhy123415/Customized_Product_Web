import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./css/Home.css";
import axios from "axios";

// 创建axios实例，配置基础URL
const api = axios.create({
  baseURL: "http://localhost:3001/api",//后期需要根据服务器ip地址进行调整，不能使用localhost，否则无法正常访问
  timeout: 5000,
});

function Home() {
  // 状态管理
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 登录状态
  const [showAuthModal, setShowAuthModal] = useState(false); // 登录/注册弹窗显示状态
  const [isLoginMode, setIsLoginMode] = useState(true); // true为登录模式，false为注册模式
  const [username, setUsername] = useState(""); // 用户名
  const [password, setPassword] = useState(""); // 密码
  const [email, setEmail] = useState(""); //邮箱
  const [currentUser, setCurrentUser] = useState(null); // 当前登录用户信息
  const [error, setError] = useState(""); //错误
  const [navItems, setNavItems] = useState([]); //首页的商品导航卡片
  const [navError, setNavError] = useState(null); // 商品数据获取错误

  // 在组件加载时获取商品卡片数据
  useEffect(() => {
    fetchNavItems();
  }, []);

  // 图片前置路径
  const dir = "./picture/";

  // 从后端获取商品卡片数据的函数
  const fetchNavItems = async () => {
    try {
      const response = await api.get("/nav-items-default");

      if (response.data.success) {
        setNavItems(response.data.result);
      } else {
        setNavError("获取数据失败");
      }
    } catch (err) {
      console.error("获取商品卡片数据失败:", err);
      setNavError("无法连接到服务器");
    }
  };

  // 处理登录
  const handleLogin = async () => {
    //输入验证
    if (!username.trim() || !password.trim()) {
      setError("用户名和密码不能为空");
      return;
    }

    setError("");

    try {
      const response = await api.post("/login", {
        username,
        password,
      });

      if (response.data.success) {
        alert(`欢迎回来，${response.data.user.name}!`);
        setCurrentUser(response.data.user);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        setUsername("");
        setPassword("");
        setError("");
      } else {
        setError(response.data.message || "登录失败");
      }
    } catch (err) {
      console.error("登录错误:", err);
      if (err.response) {
        // 服务器返回了错误状态码
        setError(err.response.data?.message || "登录失败");
      } else if (err.request) {
        // 请求已发出但没有收到响应
        setError("无法连接到服务器，请检查网络连接");
      } else {
        // 请求配置出错
        setError("请求配置错误");
      }
    }
  };

  //处理点击“登录/注册”按钮
  const handleLoginClick = () => {
    setIsLoginMode(true);
    setShowAuthModal(true);
    setError("");
  };

  // 处理注册
  const handleRegister = async () => {
    //输入项长度验证
    if (!username.trim()) {
      setError("用户名不能为空");
      return;
    }
    if (!password.trim()) {
      setError("密码不能为空");
      return;
    }
    if (!email.trim()) {
      setError("邮箱不能为空");
      return;
    }
    if (username.length > 20) {
      setError("用户名长度不能超过20个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码长度至少6个字符");
      return;
    }
    if (password.length > 20) {
      setError("密码长度不能超过20个字符");
      return;
    }
    if (email.length > 30) {
      setError("邮箱长度不能超过30个字符");
      return;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("邮箱格式不正确");
      return;
    }

    setError("");

    try {
      const response = await api.post("/register", {
        username,
        password,
        email,
      });

      if (response.data.success) {
        alert(`注册成功！欢迎${response.data.user.name}!`);
        setCurrentUser(response.data.user);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        setUsername("");
        setPassword("");
        setEmail("");
        setError("");
      } else {
        setError(response.data.message || "注册失败");
      }
    } catch (err) {
      console.error("注册错误:", err);
      if (err.response) {
        setError(err.response.data?.message || "注册失败");
      } else if (err.request) {
        setError("无法连接到服务器，请检查网络连接");
      } else {
        setError("请求配置错误");
      }
    }
  };

  // 处理退出登录
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    alert("已退出登录");
  };

  // 切换登录/注册模式
  const switchMode = () => {
    setIsLoginMode(!isLoginMode);
    setUsername("");
    setPassword("");
    setError("");
  };

  // 处理表单提交
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoginMode) {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  return (
    <>
      {/* 状态栏 */}
      <div className="status-bar">
        <div className="status-container">
          <span className="status-text">
            状态: {isLoggedIn ? "已登录" : "未登录"}
            {isLoggedIn && currentUser && ` | 用户: ${currentUser.name}`}
          </span>
          {isLoggedIn ? (
            <button onClick={handleLogout} className="logout-button">
              退出登录
            </button>
          ) : (
            <button onClick={handleLoginClick} className="login-button">
              登录/注册
            </button>
          )}
        </div>
      </div>

      {/* 商品卡片 */}
      {navError ? (
        <div className="error-container">
          <p className="error-text">{navError}</p>
          <button onClick={fetchNavItems} className="retry-button">
            重试
          </button>
        </div>
      ) : navItems.length === 0 ? (
        <div className="empty-container">
          <p>暂无数据</p>
        </div>
      ) : (
        <div className="nav-grid">
          {navItems.map((item, index) => (
            <Link key={index} to={`/detail/${item.product_id}`} className="nav-card">
              <div className="image-container">
                <img
                  src={dir+item.picture_path}
                  alt={item.product_name}
                  onError={(e) => {
                    // 图片加载失败时显示默认图片
                    e.target.src = "/picture/default.jpg";
                  }}
                />
              </div>
              <h3 className="nav-title">{item.product_name}</h3>
              {/* 可选：添加更多字段 */}
              {item.description && (
                <p className="nav-description">{item.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* 登录/注册弹窗 */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isLoginMode ? "登录" : "注册"}</h3>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  setError("");
                }}
                className="close-button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  用户名:
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="form-input"
                  placeholder="请输入用户名"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  密码:
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input"
                  placeholder="请输入密码"
                />
              </div>

              {!isLoginMode && (
                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    邮箱:
                  </label>
                  <input
                    type="text"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="form-input"
                    placeholder="请输入邮箱"
                  />
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="submit-button">
                {isLoginMode ? "登录" : "注册"}
              </button>

              <div className="switch-mode">
                <span>{isLoginMode ? "没有账号？" : "已有账号？"}</span>
                <button
                  type="button"
                  onClick={switchMode}
                  className="switch-button"
                >
                  {isLoginMode ? "去注册" : "去登录"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Home;
