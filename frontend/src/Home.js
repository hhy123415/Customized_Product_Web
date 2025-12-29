import { useState } from "react";
import "./css/Home.css";
import axios from "axios";

// 创建axios实例，配置基础URL
const api = axios.create({
  baseURL: "http://localhost:3001/api",
  timeout: 5000,
});

function Home() {
  // 状态管理
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 登录状态
  const [showAuthModal, setShowAuthModal] = useState(false); // 登录/注册弹窗显示状态
  const [isLoginMode, setIsLoginMode] = useState(true); // true为登录模式，false为注册模式
  const [username, setUsername] = useState(""); // 用户名
  const [password, setPassword] = useState(""); // 密码
  const [currentUser, setCurrentUser] = useState(null); // 当前登录用户信息
  const [error, setError] = useState("");

  // 处理登录
  const handleLogin = () => {
    // 这里应该调用API验证登录
    // 模拟登录成功
    setCurrentUser({ name: username });
    setIsLoggedIn(true);
    setShowAuthModal(false);
    // 清空表单
    setUsername("");
    setPassword("");
    alert(`欢迎回来，${username}!`);
  };

  //处理点击“登录/注册”按钮
  const handleLoginClick = () => {
    setIsLoginMode(true);
    setShowAuthModal(true);
    setError("");
  };

  // 处理注册
  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      setError("用户名和密码不能为空");
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

    setError("");

    try {
      const response = await api.post("/register", {
        username,
        password,
      });

      if (response.data.success) {
        alert(`注册成功！欢迎${response.data.user.name}!`);
        setCurrentUser(response.data.user);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        setUsername("");
        setPassword("");
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

      <p>hello!</p>

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
