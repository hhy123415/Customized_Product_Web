import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import type {
  ProductCustomizationPage,
  ProductPageParameter,
} from "../Interface";
import styles from "../css/DynamicProduct.module.css"; // 你可以新建一个样式文件

function DynamicProductCustomization() {
  const { pageId } = useParams<{ pageId: string }>();
  const [pageData, setPageData] = useState<ProductCustomizationPage | null>(
    null,
  );
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPageDetail = async () => {
      try {
        // 使用一个无需 userId 校验的详情接口（如果后端没写，建议加上）
        const response = await api.get(
          `/public/product-customization-pages/${pageId}`,
        );
        setPageData(response.data.page);

        // 初始化表单默认值
        const initialForm: Record<string, string> = {};
        response.data.page.parameters.forEach((param: ProductPageParameter) => {
          initialForm[param.id] = param.default_value || "";
        });
        setFormData(initialForm);
      } catch (err) {
        console.error("加载产品定制信息失败:", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (pageId) fetchPageDetail();
  }, [pageId]);

  if (isLoading) return <div className={styles.loading}>加载中...</div>;
  if (!pageData)
    return <div className={styles.error}>未找到相关产品定制页面。</div>;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1>{pageData.product_name}</h1>
        <p>{pageData.product_summary}</p>
      </header>

      <section className={styles.configSection}>
        <div className={styles.formCard}>
          <h3>定制选项</h3>
          {pageData.parameters.map((param) => (
            <div key={param.id} className={styles.field}>
              <label>
                {param.name}{" "}
                {param.required && <span className={styles.req}>*</span>}
              </label>

              {param.type === "select" ? (
                <select
                  value={formData[param.id]}
                  onChange={(e) =>
                    setFormData({ ...formData, [param.id]: e.target.value })
                  }
                >
                  <option value="">请选择{param.name}</option>
                  {param.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={styles.inputWrapper}>
                  <input
                    type={param.type === "number" ? "number" : "text"}
                    value={formData[param.id]}
                    onChange={(e) =>
                      setFormData({ ...formData, [param.id]: e.target.value })
                    }
                    placeholder={`请输入${param.name}`}
                  />
                  {param.unit && (
                    <span className={styles.unit}>{param.unit}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          <button className={styles.submitBtn}>提交定制意向 (询价)</button>
        </div>
      </section>
    </main>
  );
}

export default DynamicProductCustomization;
