import React from "react";
import styles from "../css/About.module.css";

const About: React.FC = () => {
  return (
    <div className={styles["about-container"]}>
      <div className={styles["about-header"]}>
        <h1>关于本网站</h1>
        <p className={styles["subtitle"]}>毕业设计项目 · 仅供学习交流</p>
      </div>

      <div className={styles["about-content"]}>
        <section className={styles["section"]}>
          <h2>项目简介</h2>
          <p>
            本网站是一个毕业设计项目，旨在展示现代Web开发技术和实践应用。
            项目采用前后端分离架构，使用React、TypeScript、Node.js等技术栈开发。
          </p>
        </section>

        <section className={styles["section"]}>
          <h2>学习目的</h2>
          <ul>
            <li>掌握现代Web开发技术栈</li>
            <li>实践前后端分离架构设计</li>
            <li>学习用户认证与授权机制</li>
            <li>探索创意分享与产品定制功能</li>
            <li>理解企业级应用开发流程</li>
          </ul>
        </section>

        <section className={styles["section"]}>
          <h2>技术栈</h2>
          <div className={styles["tech-stack"]}>
            <div className={styles["tech-item"]}>
              <h3>前端</h3>
              <ul>
                <li>React 18 + TypeScript</li>
                <li>Vite 构建工具</li>
                <li>React Router 路由管理</li>
                <li>CSS Modules 样式管理</li>
              </ul>
            </div>
            <div className={styles["tech-item"]}>
              <h3>后端</h3>
              <ul>
                <li>Node.js + Express</li>
                <li>TypeScript 类型安全</li>
                <li>PostgreSQL 数据库</li>
                <li>JWT 用户认证</li>
              </ul>
            </div>
            <div className={styles["tech-item"]}>
              <h3>部署</h3>
              <ul>
                <li>Docker 容器化</li>
                <li>Nginx 反向代理</li>
                <li>Docker Compose 编排</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles["section"]}>
          <h2>免责声明</h2>
          <div className={styles["warning-box"]}>
            <p>
              <strong>重要提示：</strong>
            </p>
            <p>
              1. 本网站为毕业设计项目，仅用于学习交流目的，不用于商业用途。
            </p>
            <p>
              2. 网站中展示的所有内容（包括但不限于图片、文字、设计等）均为学习示例，
              如有侵权，请联系我们立即删除。
            </p>
            <p>
              3. 本网站不存储用户敏感信息，所有数据仅为演示使用。
            </p>
            <p>
              4. 网站功能可能存在不完善之处，请勿用于生产环境。
            </p>
          </div>
        </section>

        <section className={styles["section"]}>
          <h2>版权声明</h2>
          <p>
            本网站代码开源，遵循MIT许可证。但请注意：
          </p>
          <ul>
            <li>网站中使用的第三方资源（如图片、图标等）可能受版权保护</li>
            <li>请勿直接复制网站中的受版权保护内容</li>
            <li>如需使用相关资源，请确保获得合法授权</li>
            <li>如发现侵权内容，请及时联系我们删除</li>
          </ul>
        </section>

        <section className={styles["section"]}>
          <h2>联系方式</h2>
          <p>
            如有任何问题或建议，欢迎通过以下方式联系：
          </p>
          <ul>
            <li>邮箱：3220103452@zju.edu.cn</li>
          </ul>
        </section>

        <footer className={styles["footer"]}>
          <p>© 2026 毕业设计项目 · 仅供学习交流 · 侵权必删</p>
          <p className={styles["footer-note"]}>
            本网站所有内容均为学习示例，不构成任何商业承诺
          </p>
        </footer>
      </div>
    </div>
  );
};

export default About;