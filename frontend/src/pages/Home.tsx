import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  Users,
  Pencil,
  Sparkles,
  LayoutGrid,
  FileText,
  CalendarDays,
  ClipboardList,
  LogIn,
  LayoutDashboard,
  Inbox,
} from "lucide-react";
import api from "../api/axios";
import styles from "../css/Home.module.css";
import LoginStyle from "../css/LoginTip.module.css";
import type { ProductCustomizationPage, ProductPageStatus } from "../Interface";
import { useAuth } from "../hooks/useAuth";

const statusTextMap: Record<ProductPageStatus, string> = {
  draft: "草稿",
  pending_review: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

function Home() {
  const { auth } = useAuth();
  const [pendingPages, setPendingPages] = useState<ProductCustomizationPage[]>(
    [],
  );

  useEffect(() => {
    if (!auth.isLoggedIn || auth.role !== "enterprise") {
      setPendingPages([]);
      return;
    }

    const loadPendingPages = async () => {
      try {
        const response = await api.get("/enterprise/product-pages", {
          params: { status: "pending_review" },
        });
        setPendingPages(
          (response.data.pages || []) as ProductCustomizationPage[],
        );
      } catch (err) {
        console.error("load pending enterprise pages failed:", err);
        setPendingPages([]);
      }
    };

    loadPendingPages();
  }, [auth.isLoggedIn, auth.role]);

  return (
    <div className={LoginStyle.container}>
      {!auth.isLoggedIn && (
        <div className={LoginStyle.card}>
          <h1 className={LoginStyle.title}>请先登录以继续使用平台功能</h1>
          <p className={LoginStyle.subtitle}>
            登录后可根据角色进入对应工作台。
          </p>
          <div className={LoginStyle.actionArea}>
            <Link to="/login" className={LoginStyle.loginBtn}>
              <LogIn
                size={18}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              立即登录
            </Link>
          </div>
        </div>
      )}

      {auth.isLoggedIn && (
        <div className={styles.dashboardCard}>
          <div className={styles.header}>
            <p className={styles.title}>
              <LayoutDashboard
                size={24}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              欢迎使用工作台
            </p>
            <p className={styles.subtitle}>
              {auth.role === "enterprise"
                ? "企业用户可在这里创建并发布产品定制页面。"
                : auth.role === "admin"
                  ? "管理员可在这里处理企业页面审核与用户信息查询。"
                  : "请选择你要使用的功能模块。"}
            </p>
          </div>

          <div className={styles.grid}>
            {auth.role === "admin" && (
              <>
                <Link
                  to="/admin/product-pages/review"
                  className={`${styles.menuBtn} ${styles.adminTheme}`}
                >
                  <ClipboardCheck
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  审核产品定制页面
                </Link>
                <Link
                  to="/admin/user-query"
                  className={`${styles.menuBtn} ${styles.adminTheme}`}
                >
                  <Users
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  查询用户信息
                </Link>
              </>
            )}

            {auth.role === "enterprise" && (
              <Link
                to="/enterprise/product-pages/editor"
                className={`${styles.menuBtn} ${styles.enterpriseTheme}`}
              >
                <Pencil
                  size={20}
                  style={{ marginRight: "8px", verticalAlign: "middle" }}
                />
                产品定制页面编辑器
              </Link>
            )}

            {auth.role === "regular" && (
              <>
                <Link
                  to="/CreativeSquare"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <Sparkles
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  创意广场
                </Link>
                <Link
                  to="/product-customization"
                  className={`${styles.menuBtn} ${styles.userTheme}`}
                >
                  <LayoutGrid
                    size={20}
                    style={{ marginRight: "8px", verticalAlign: "middle" }}
                  />
                  浏览产品定制示例
                </Link>
              </>
            )}
          </div>

          {auth.role === "enterprise" && (
            <section className={styles.pendingSection}>
              <div className={styles.pendingHeader}>
                <ClipboardList
                  size={20}
                  style={{ marginRight: "8px", verticalAlign: "middle" }}
                />
                <h2>我的待审核页面</h2>
                <span>{pendingPages.length} 个</span>
              </div>

              {pendingPages.length === 0 ? (
                <p className={styles.pendingEmpty}>
                  {" "}
                  <Inbox
                    size={18}
                    style={{ marginRight: "6px", verticalAlign: "middle" }}
                  />
                  当前没有待审核页面。
                </p>
              ) : (
                <div className={styles.pendingList}>
                  {pendingPages.map((page) => (
                    <article key={page.page_id} className={styles.pendingItem}>
                      <div>
                        <p className={styles.pendingName}>
                          <FileText
                            size={16}
                            style={{
                              marginRight: "6px",
                              verticalAlign: "middle",
                            }}
                          />
                          {page.product_name}
                        </p>
                        <p className={styles.pendingMeta}>
                          <CalendarDays
                            size={14}
                            style={{
                              marginRight: "4px",
                              verticalAlign: "middle",
                            }}
                          />
                          最后更新：{formatDate(page.updated_at)}
                        </p>
                      </div>
                      <span
                        className={`${styles.statusBadge} ${styles[page.status]}`}
                      >
                        {statusTextMap[page.status]}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default Home;
