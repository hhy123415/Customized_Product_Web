import { Link } from "react-router-dom";
import styles from "../css/ProductCustomization.module.css";

function ProductCustomization() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1>产品定制中心</h1>
        <p>
          选择您想要配置的产品。我们会根据参数自动计算价格，并提供实时预览。
        </p>
      </section>

      <section className={styles.grid}>
        <Link to="/product-customization/pool-cue" className={styles.card}>
          <img
            src="cue-2d-preview.jpg"
            alt="碳纤维台球杆定制预览"
            className={styles.cardImage}
            loading="lazy"
          />
          <h2>碳纤维台球杆定制</h2>
          <span className={styles.cta}>进入定制</span>
        </Link>

        <Link to="/product-customization/carbon-paddle" className={styles.card}>
          <img
            src="Carbon-Canoe-Paddle.jpg"
            alt="碳纤维划船桨定制预览"
            className={styles.cardImage}
            loading="lazy"
          />
          <h2>碳纤维划船桨定制</h2>
          <span className={styles.cta}>进入定制</span>
        </Link>
      </section>
    </main>
  );
}

export default ProductCustomization;
