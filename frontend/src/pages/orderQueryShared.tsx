import styles from "../css/AdminUserQuery.module.css";

export interface OrderConfiguration {
  [key: string]: string | number | boolean | OrderConfiguration;
}

export type OrderStatus =
  | "submitted"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

export const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

export const statusTextMap: Record<OrderStatus, string> = {
  submitted: "已提交",
  processing: "处理中",
  shipped: "已发货",
  completed: "已完成",
  cancelled: "已取消",
};

export const statusStyleMap: Record<OrderStatus, string> = {
  submitted: styles.statusSubmitted,
  processing: styles.statusProcessing,
  shipped: styles.statusShipped,
  completed: styles.statusCompleted,
  cancelled: styles.statusCancelled,
};

const CONFIG_TRANSLATION: Record<string, string> = {
  lengthcm: "长度(厘米)",
  weightoz: "重量(盎司)",
  wraptype: "握把类型",
  jointtype: "接牙类型",
  caseoption: "球杆盒",
  finishstyle: "表面涂装",
  tipdiametermm: "皮头直径",
  "stainless-steel": "不锈钢",
  titanium: "钛合金",
  "carbon-grip": "碳纤维防滑",
  "genuine-leather": "真皮",
  none: "无",
  basic: "基础软包",
  pro: "专业硬壳",
  true: "是",
  false: "否",
  "matte-carbon": "磨砂碳纹",
  "gloss-carbon": "高亮碳纹",
  "ocean-blue": "海洋蓝",
};

const t = (text: string | number | boolean): string => {
  const key = String(text).toLowerCase();
  return CONFIG_TRANSLATION[key] || String(text);
};

export const RenderConfiguration = ({
  config,
}: {
  config: OrderConfiguration;
}) => {
  if (!config || typeof config !== "object") return null;

  return (
    <div className={styles.configContainer}>
      {Object.entries(config).map(([key, value]) => (
        <div key={key} className={styles.configItem}>
          <span className={styles.configLabel}>{t(key)}:</span>
          <span className={styles.configValue}>
            {typeof value === "object" ? (
              <RenderConfiguration config={value as OrderConfiguration} />
            ) : (
              t(value)
            )}
          </span>
        </div>
      ))}
    </div>
  );
};
