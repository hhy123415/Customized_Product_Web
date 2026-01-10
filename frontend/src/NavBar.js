import "./css/NavBar.css";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
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
          <img src={"picture/default.png"} alt="logo" />
          <span>网站名称</span>
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
          <li>
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>
              首页
            </Link>
          </li>
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
        </ul>
      </nav>
    </header>
  );
}

export default NavBar;