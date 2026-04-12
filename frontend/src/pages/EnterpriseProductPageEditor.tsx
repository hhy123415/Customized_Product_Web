import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import type {
  ProductCustomizationPage,
  ProductPageParameter,
  ProductPageStatus,
} from "../Interface";
import styles from "../css/EnterpriseProductPageEditor.module.css";

const statusTextMap: Record<ProductPageStatus, string> = {
  draft: "草稿",
  pending_review: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};

const createParameter = (): ProductPageParameter => ({
  id: `param-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: "",
  type: "text",
  required: false,
  unit: "",
  default_value: "",
  options: [],
});

function EnterpriseProductPageEditor() {
  const [pages, setPages] = useState<ProductCustomizationPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [productSummary, setProductSummary] = useState("");
  const [parameters, setParameters] = useState<ProductPageParameter[]>([createParameter()]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPage = useMemo(
    () => pages.find((page) => page.page_id === selectedPageId) || null,
    [pages, selectedPageId],
  );

  const loadPages = async (preferredPageId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get("/enterprise/product-pages");
      const nextPages = (response.data.pages || []) as ProductCustomizationPage[];
      setPages(nextPages);

      const nextSelected =
        preferredPageId && nextPages.some((page) => page.page_id === preferredPageId)
          ? preferredPageId
          : nextPages[0]?.page_id || "";
      setSelectedPageId(nextSelected);

      if (nextSelected) {
        const current = nextPages.find((page) => page.page_id === nextSelected);
        if (current) {
          setProductName(current.product_name);
          setProductSummary(current.product_summary || "");
          setParameters(
            current.parameters.length > 0
              ? current.parameters.map((item) => ({
                  ...item,
                  unit: item.unit || "",
                  default_value: item.default_value || "",
                  options: item.options || [],
                }))
              : [createParameter()],
          );
        }
      } else {
        handleCreateNew(false);
      }
    } catch (err) {
      console.error("load enterprise pages failed:", err);
      setError("无法加载企业定制页面。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const handleCreateNew = (clearMessage = true) => {
    setSelectedPageId("");
    setProductName("");
    setProductSummary("");
    setParameters([createParameter()]);
    setError(null);
    if (clearMessage) {
      setMessage("已切换到新页面草稿。");
    }
  };

  const handleSelectPage = (page: ProductCustomizationPage) => {
    setSelectedPageId(page.page_id);
    setProductName(page.product_name);
    setProductSummary(page.product_summary || "");
    setParameters(
      page.parameters.length > 0
        ? page.parameters.map((item) => ({
            ...item,
            unit: item.unit || "",
            default_value: item.default_value || "",
            options: item.options || [],
          }))
        : [createParameter()],
    );
    setMessage(null);
    setError(null);
  };

  const updateParameter = (
    parameterId: string,
    updater: (parameter: ProductPageParameter) => ProductPageParameter,
  ) => {
    setParameters((current) =>
      current.map((parameter) =>
        parameter.id === parameterId ? updater(parameter) : parameter,
      ),
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.post("/enterprise/product-pages", {
        page_id: selectedPageId || undefined,
        product_name: productName,
        product_summary: productSummary,
        parameters: parameters.map((parameter) => ({
          ...parameter,
          options:
            parameter.type === "select"
              ? (parameter.options || []).filter((option) => option.trim())
              : [],
        })),
      });

      const savedPage = response.data.page as ProductCustomizationPage;
      setMessage("页面草稿已保存。");
      await loadPages(savedPage.page_id);
    } catch (err: unknown) {
      console.error("save page failed:", err);
      setError("保存失败，请检查产品名称和参数配置。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPageId) {
      setError("请先保存页面，再提交审核。");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/enterprise/product-pages/${selectedPageId}/submit`);
      setMessage("页面已提交管理员审核。");
      await loadPages(selectedPageId);
    } catch (err) {
      console.error("submit page failed:", err);
      setError("提交失败，请确认至少配置了一个有效参数。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1>产品定制页面编辑器</h1>
          <button type="button" className={styles.secondaryBtn} onClick={() => handleCreateNew()}>
            新建页面
          </button>
        </div>
        <p className={styles.sidebarTip}>保存为草稿后可继续编辑，发布后进入管理员审核。</p>

        {isLoading ? (
          <p className={styles.tip}>正在加载页面列表...</p>
        ) : pages.length === 0 ? (
          <p className={styles.tip}>还没有已保存的定制页面。</p>
        ) : (
          <div className={styles.pageList}>
            {pages.map((page) => (
              <button
                key={page.page_id}
                type="button"
                className={`${styles.pageItem} ${
                  selectedPageId === page.page_id ? styles.pageItemActive : ""
                }`}
                onClick={() => handleSelectPage(page)}
              >
                <span className={styles.pageName}>{page.product_name}</span>
                <span className={`${styles.statusBadge} ${styles[page.status]}`}>
                  {statusTextMap[page.status]}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.editor}>
        <div className={styles.editorHeader}>
          <div>
            <h2>{selectedPage ? "编辑产品页面" : "创建产品页面"}</h2>
            <p>
              企业用户可配置产品名称、说明和可调节参数，发布后由管理员审核。
            </p>
          </div>
          {selectedPage && (
            <div className={styles.reviewInfo}>
              <span className={`${styles.statusBadge} ${styles[selectedPage.status]}`}>
                {statusTextMap[selectedPage.status]}
              </span>
              {selectedPage.review_comment && (
                <p className={styles.reviewComment}>审核意见：{selectedPage.review_comment}</p>
              )}
            </div>
          )}
        </div>

        <div className={styles.formCard}>
          <label className={styles.field}>
            <span>产品名称</span>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="例如：智能台球杆 Pro"
            />
          </label>

          <label className={styles.field}>
            <span>页面说明</span>
            <textarea
              value={productSummary}
              onChange={(e) => setProductSummary(e.target.value)}
              rows={4}
              placeholder="简要描述产品亮点、适用人群和定制规则。"
            />
          </label>

          <div className={styles.parameterHeader}>
            <h3>可调节参数</h3>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setParameters((current) => [...current, createParameter()])}
            >
              添加参数
            </button>
          </div>

          <div className={styles.parameterList}>
            {parameters.map((parameter, index) => (
              <article key={parameter.id} className={styles.parameterCard}>
                <div className={styles.parameterTop}>
                  <strong>参数 {index + 1}</strong>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() =>
                      setParameters((current) =>
                        current.length === 1
                          ? [createParameter()]
                          : current.filter((item) => item.id !== parameter.id),
                      )
                    }
                  >
                    删除
                  </button>
                </div>

                <div className={styles.parameterGrid}>
                  <label className={styles.field}>
                    <span>参数名称</span>
                    <input
                      value={parameter.name}
                      onChange={(e) =>
                        updateParameter(parameter.id, (current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
                      placeholder="例如：长度"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>参数类型</span>
                    <select
                      value={parameter.type}
                      onChange={(e) =>
                        updateParameter(parameter.id, (current) => ({
                          ...current,
                          type: e.target.value as ProductPageParameter["type"],
                          options:
                            e.target.value === "select"
                              ? current.options && current.options.length > 0
                                ? current.options
                                : [""]
                              : [],
                        }))
                      }
                    >
                      <option value="text">文本</option>
                      <option value="number">数值</option>
                      <option value="select">选项</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span>默认值</span>
                    <input
                      value={parameter.default_value || ""}
                      onChange={(e) =>
                        updateParameter(parameter.id, (current) => ({
                          ...current,
                          default_value: e.target.value,
                        }))
                      }
                      placeholder="可选"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>单位</span>
                    <input
                      value={parameter.unit || ""}
                      onChange={(e) =>
                        updateParameter(parameter.id, (current) => ({
                          ...current,
                          unit: e.target.value,
                        }))
                      }
                      placeholder="例如：cm"
                    />
                  </label>
                </div>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={parameter.required}
                    onChange={(e) =>
                      updateParameter(parameter.id, (current) => ({
                        ...current,
                        required: e.target.checked,
                      }))
                    }
                  />
                  必填参数
                </label>

                {parameter.type === "select" && (
                  <label className={styles.field}>
                    <span>选项列表</span>
                    <textarea
                      value={(parameter.options || []).join("\n")}
                      onChange={(e) =>
                        updateParameter(parameter.id, (current) => ({
                          ...current,
                          options: e.target.value.split("\n"),
                        }))
                      }
                      rows={4}
                      placeholder={"每行一个选项，例如：\n标准版\n进阶版\n旗舰版"}
                    />
                  </label>
                )}
              </article>
            ))}
          </div>

          {(message || error) && (
            <p className={error ? styles.error : styles.message}>{error || message}</p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存草稿"}
            </button>
            <button
              type="button"
              className={styles.publishBtn}
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedPageId}
            >
              {isSubmitting ? "提交中..." : "发布并提交审核"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default EnterpriseProductPageEditor;
