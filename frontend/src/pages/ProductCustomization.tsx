import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import type { ProductCustomizationPage } from "../Interface";
import styles from "../css/ProductCustomization.module.css";

function ProductCustomization() {
  const [dynamicPages, setDynamicPages] = useState<ProductCustomizationPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取审核通过的动态定制页面
  useEffect(() => {
    const fetchPages = async () => {
      try {
        // 假设后端有一个公共接口获取所有已发布的定制页面
        // 或者复用 /enterprise/product-pages 并在此处进行过滤
        const response = await api.get("/public/product-customization-pages");
        const allPages = (response.data.pages || []) as ProductCustomizationPage[];
        
        // 仅保留已审核通过的页面
        const approvedPages = allPages.filter(page => page.status === 'approved');
        setDynamicPages(approvedPages);
      } catch (err) {
        console.error("Failed to load dynamic customization pages:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPages();
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1>产品定制中心</h1>
        <p>
          选择您想要配置的产品。我们会根据参数自动计算价格，并提供实时可视化预览。
        </p>
      </section>

      <section className={styles.grid}>
        {/* --- 静态入口：原有的碳纤维台球杆 --- */}
        <Link to="/product-customization/pool-cue" className={styles.card}>
          <span className={styles.badge}>3D 参数化</span>
          <h2>碳纤维台球杆定制</h2>
          <p>支持长度、重量、接牙、涂装与配件选配，并实时更新价格。</p>
          <span className={styles.cta}>进入定制</span>
        </Link>

        {/* --- 动态入口：从数据库加载的页面 --- */}
        {dynamicPages.map((page) => (
          <Link 
            key={page.page_id} 
            to={`/product-customization/dynamic/${page.page_id}`} 
            className={styles.card}
          >
            <span className={`${styles.badge} ${styles.dynamicBadge}`}>企业定制</span>
            <h2>{page.product_name}</h2>
            <p>{page.product_summary || "暂无产品说明"}</p>
            <span className={styles.cta}>进入定制</span>
          </Link>
        ))}

        {/* 加载状态占位（可选） */}
        {isLoading && <p className={styles.loadingText}>正在探索更多定制可能...</p>}
      </section>
    </main>
  );
}

export default ProductCustomization;