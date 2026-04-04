import { Link } from "react-router-dom";
import styles from "../css/ProductCustomization.module.css";

function ProductCustomization() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1>产品定制中心</h1>
        <p>
          选择您想要配置的产品。我们会根据参数自动计算价格，并提供实时可视化预览。
        </p>
      </section>

      <section className={styles.grid}>
        <Link to="/product-customization/pool-cue" className={styles.card}>
          <span className={styles.badge}>3D 参数化</span>
          <h2>碳纤维台球杆定制</h2>
          <p>支持长度、重量、接牙、涂装与配件选配，并实时更新价格。</p>
          <span className={styles.cta}>进入定制</span>
        </Link>
      </section>
    </main>
  );
}

export default ProductCustomization;
