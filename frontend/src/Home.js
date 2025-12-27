import { useState } from 'react';

function Home() {
  // 状态管理
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 登录状态
  const [showAuthModal, setShowAuthModal] = useState(false); // 登录/注册弹窗显示状态
  const [isLoginMode, setIsLoginMode] = useState(true); // true为登录模式，false为注册模式
  const [username, setUsername] = useState(''); // 用户名
  const [password, setPassword] = useState(''); // 密码
  const [currentUser, setCurrentUser] = useState(null); // 当前登录用户信息

  // 处理登录
  const handleLogin = () => {
    // 这里应该调用API验证登录
    // 模拟登录成功
    setCurrentUser({ name: username });
    setIsLoggedIn(true);
    setShowAuthModal(false);
    // 清空表单
    setUsername('');
    setPassword('');
    alert(`欢迎回来，${username}!`);
  };

  // 处理注册
  const handleRegister = () => {
    // 这里应该调用API进行注册
    // 模拟注册成功并自动登录
    setCurrentUser({ name: username });
    setIsLoggedIn(true);
    setShowAuthModal(false);
    setUsername('');
    setPassword('');
    alert(`注册成功！欢迎${username}!`);
  };

  // 处理退出登录
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    alert('已退出登录');
  };

  // 切换登录/注册模式
  const switchMode = () => {
    setIsLoginMode(!isLoginMode);
    setUsername('');
    setPassword('');
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
      <div style={styles.statusBar}>
        <div style={styles.statusContainer}>
          <span style={styles.statusText}>
            状态: {isLoggedIn ? '已登录' : '未登录'}
            {isLoggedIn && currentUser && ` | 用户: ${currentUser.name}`}
          </span>
          {isLoggedIn ? (
            <button onClick={handleLogout} style={styles.logoutButton}>
              退出登录
            </button>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)} 
              style={styles.loginButton}
            >
              登录/注册
            </button>
          )}
        </div>
      </div>

      <p>hello!</p>

      {/* 登录/注册弹窗 */}
      {showAuthModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>{isLoginMode ? '登录' : '注册'}</h3>
              <button 
                onClick={() => setShowAuthModal(false)} 
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label htmlFor="username" style={styles.label}>用户名:</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="请输入用户名"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label htmlFor="password" style={styles.label}>密码:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="请输入密码"
                />
              </div>
              
              <button type="submit" style={styles.submitButton}>
                {isLoginMode ? '登录' : '注册'}
              </button>
              
              <div style={styles.switchMode}>
                <span>
                  {isLoginMode ? '没有账号？' : '已有账号？'}
                </span>
                <button 
                  type="button" 
                  onClick={switchMode} 
                  style={styles.switchButton}
                >
                  {isLoginMode ? '去注册' : '去登录'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// 样式定义
const styles = {
  // 状态栏样式
  statusBar: {
    backgroundColor: '#f8f9fa',
    padding: '10px 20px',
    borderBottom: '1px solid #dee2e6',
    marginBottom: '20px',
  },
  statusContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  statusText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.3s',
  },
  logoutButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.3s',
  },

  // 弹窗样式
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    width: '400px',
    maxWidth: '90%',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    lineHeight: '1',
    padding: '0',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 表单样式
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box',
  },
  submitButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    marginTop: '10px',
    transition: 'background-color 0.3s',
  },
  switchMode: {
    marginTop: '20px',
    textAlign: 'center',
    color: '#666',
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '5px',
    padding: '0',
    textDecoration: 'underline',
  },
};

// 添加按钮悬停效果
styles.loginButton[':hover'] = { backgroundColor: '#0056b3' };
styles.logoutButton[':hover'] = { backgroundColor: '#5a6268' };
styles.submitButton[':hover'] = { backgroundColor: '#218838' };
styles.closeButton[':hover'] = { backgroundColor: '#f8f9fa', borderRadius: '50%' };
styles.switchButton[':hover'] = { color: '#0056b3' };

export default Home;