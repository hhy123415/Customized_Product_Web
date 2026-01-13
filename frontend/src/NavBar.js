import "./css/NavBar.css";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);//控制“关于”菜单
  const location = useLocation();
  const aboutRef = useRef(null);

  // 当路由变化时关闭移动菜单
  useEffect(() => {
    setIsMenuOpen(false);
    setIsAboutOpen(false);
  }, [location]);

  // 点击页面其他区域关闭关于下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aboutRef.current && !aboutRef.current.contains(event.target)) {
        setIsAboutOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 处理关于菜单的点击事件
  const handleAboutClick = () => {
    setIsAboutOpen(!isAboutOpen);
  };

  // 处理关于按钮的键盘事件
  const handleAboutKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setIsAboutOpen(true);
    } else if (e.key === "Escape") {
      setIsAboutOpen(false);
    }
  };

  // 处理下拉菜单项点击
  const handleDropdownItemClick = () => {
    setIsAboutOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <header className="navbar-container">
      <nav className="navbar">
        <div className="nav-logo">
          <Link to="/">
            <img
              src={
                "https://ueeshop.ly200-cdn.com/u_file/UPAQ/UPAQ575/2104/photo/a4a7be66ba.jpg?x-oss-process=image/format,webp"
              }
              alt="logo"
            />
          </Link>
        </div>

        {/* 移动端菜单按钮 */}
        <button
          className={`menu-toggle ${isMenuOpen ? "open" : ""}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "关闭菜单" : "打开菜单"}
          aria-expanded={isMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`nav-links ${isMenuOpen ? "open" : ""}`}>
          {/* 关于 */}
          <li className="nav-item-with-dropdown" ref={aboutRef}>
            <button
              className={`nav-dropdown-toggle ${
                location.pathname.startsWith("/about") ? "active" : ""
              }`}
              onClick={handleAboutClick}
              onKeyDown={handleAboutKeyDown}
              aria-expanded={isAboutOpen}
              aria-haspopup="menu"
            >
              关于
              <span className={`dropdown-arrow ${isAboutOpen ? "open" : ""}`}>
                ▼
              </span>
            </button>
            <ul
              className={`dropdown-menu ${isAboutOpen ? "open" : ""}`}
              role="menu"
              aria-label="关于子菜单"
            >
              <li role="none">
                <Link
                  to="/about/platform"
                  className={
                    location.pathname === "/about/platform" ? "active" : ""
                  }
                  onClick={handleDropdownItemClick}
                  role="menuitem"
                >
                  平台介绍
                </Link>
              </li>
              <li role="none">
                <Link
                  to="/about/capabilities"
                  className={
                    location.pathname === "/about/capabilities" ? "active" : ""
                  }
                  onClick={handleDropdownItemClick}
                  role="menuitem"
                >
                  能力展示
                </Link>
              </li>
              <li role="none">
                <Link
                  to="/about/contact"
                  className={
                    location.pathname === "/about/contact" ? "active" : ""
                  }
                  onClick={handleDropdownItemClick}
                  role="menuitem"
                >
                  联系我们
                </Link>
              </li>
            </ul>
          </li>
          {/* 个人中心 */}
          <li className="nav-item-with-dropdown" ref={aboutRef}>
            <button
              className={`nav-dropdown-toggle ${
                location.pathname.startsWith("/about") ? "active" : ""
              }`}
              onClick={handleAboutClick}
              onKeyDown={handleAboutKeyDown}
              aria-expanded={isAboutOpen}
              aria-haspopup="menu"
            >
              个人中心
              <span className={`dropdown-arrow ${isAboutOpen ? "open" : ""}`}>
                ▼
              </span>
            </button>
            <ul
              className={`dropdown-menu ${isAboutOpen ? "open" : ""}`}
              role="menu"
              aria-label="关于子菜单"
            >
              <li role="none">
                <Link
                  to="/about/platform"
                  className={
                    location.pathname === "/about/platform" ? "active" : ""
                  }
                  onClick={handleDropdownItemClick}
                  role="menuitem"
                >
                  账号设置
                </Link>
              </li>
              <li role="none">
                <Link
                  to="/about/capabilities"
                  className={
                    location.pathname === "/about/capabilities" ? "active" : ""
                  }
                  onClick={handleDropdownItemClick}
                  role="menuitem"
                >
                  我的订单
                </Link>
              </li>
              <li role="none">
                <Link
                  to="/about/contact"
                  className={
                    location.pathname === "/about/contact" ? "active" : ""
                  }
                  onClick={handleDropdownItemClick}
                  role="menuitem"
                >
                  我的创意
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default NavBar;
