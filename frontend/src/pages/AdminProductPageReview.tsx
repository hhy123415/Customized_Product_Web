import { useEffect, useState } from "react";
import api from "../api/axios";
import type { ProductCustomizationPage, ProductPageStatus } from "../Interface";
import styles from "../css/AdminProductPageReview.module.css";

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

function AdminProductPageReview() {
  const [pages, setPages] = useState<ProductCustomizationPage[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProductPageStatus | "all">("pending_review");
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPages = async (nextStatus: ProductPageStatus | "all" = statusFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get("/admin/product-pages", {
        params: nextStatus === "all" ? {} : { status: nextStatus },
      });
      setPages((response.data.pages || []) as ProductCustomizationPage[]);
    } catch (err) {
      console.error("load review pages failed:", err);
      setError("无法加载待审核页面。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPages(statusFilter);
  }, [statusFilter]);

  const handleReview = async (pageId: string, action: "approve" | "reject") => {
    try {
      await api.post(`/admin/product-pages/${pageId}/review`, {
        action,
        review_comment: reviewComment[pageId] || "",
      });
      await loadPages(statusFilter);
    } catch (err) {
      console.error("review page failed:", err);
      setError("审核提交失败，请稍后重试。");
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>产品定制页面审核</h1>
            <p>管理员可审核企业发布的定制页面，查看参数配置并给出审核意见。</p>
          </div>

          <select
            value={statusFilter}
            className={styles.filter}
            onChange={(e) => setStatusFilter(e.target.value as ProductPageStatus | "all")}
          >
            <option value="pending_review">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="draft">草稿</option>
            <option value="all">全部状态</option>
          </select>
        </div>

        {isLoading && <p className={styles.tip}>正在加载审核列表...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!isLoading && !error && (
          <div className={styles.list}>
            {pages.length === 0 ? (
              <p className={styles.tip}>当前筛选条件下暂无页面。</p>
            ) : (
              pages.map((page) => (
                <article key={page.page_id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div>
                      <h2>{page.product_name}</h2>
                      <p className={styles.meta}>
                        发布企业：{page.publisher_username || page.user_id} | 更新时间：{formatDate(page.updated_at)}
                      </p>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[page.status]}`}>
                      {statusTextMap[page.status]}
                    </span>
                  </div>

                  {page.product_summary && <p className={styles.summary}>{page.product_summary}</p>}

                  <div className={styles.parameterList}>
                    {page.parameters.map((parameter) => (
                      <div key={parameter.id} className={styles.parameterItem}>
                        <strong>{parameter.name}</strong>
                        <span>
                          {parameter.type === "text"
                            ? "文本"
                            : parameter.type === "number"
                              ? "数值"
                              : "选项"}
                          {parameter.required ? " / 必填" : " / 选填"}
                          {parameter.unit ? ` / 单位：${parameter.unit}` : ""}
                          {parameter.default_value ? ` / 默认值：${parameter.default_value}` : ""}
                          {parameter.type === "select" && parameter.options?.length
                            ? ` / 选项：${parameter.options.join("、")}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  <textarea
                    className={styles.commentBox}
                    rows={3}
                    value={reviewComment[page.page_id] || page.review_comment || ""}
                    onChange={(e) =>
                      setReviewComment((current) => ({
                        ...current,
                        [page.page_id]: e.target.value,
                      }))
                    }
                    placeholder="填写审核意见，驳回时建议说明修改点。"
                  />

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      onClick={() => handleReview(page.page_id, "approve")}
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      className={styles.rejectBtn}
                      onClick={() => handleReview(page.page_id, "reject")}
                    >
                      驳回
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminProductPageReview;
