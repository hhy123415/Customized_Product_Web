import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { AdminOrder } from "../Interface";
import styles from "../css/AdminUserQuery.module.css"; // 复用相同样式

interface OrderConfiguration {
  [key: string]: string | number | boolean | OrderConfiguration;
}

interface PoolCueOrder {
  order_id: string;
  user_id: string;
  product_name: string;
  customization_mode: "preset" | "freeform";
  configuration: OrderConfiguration;
  pricing_lines: unknown[];
  total_price: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  order_note: string | null;
  design_image_path: string | null;
  design_description: string | null;
  status: "submitted" | "processing" | "shipped" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  username?: string; // 关联查询的用户名
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

const statusTextMap: Record<PoolCueOrder["status"], string> = {
  submitted: "已提交",
  processing: "处理中",
  shipped: "已发货",
  completed: "已完成",
  cancelled: "已取消",
};

const statusStyleMap: Record<PoolCueOrder["status"], string> = {
  submitted: styles.statusSubmitted,
  processing: styles.statusProcessing,
  shipped: styles.statusShipped,
  completed: styles.statusCompleted,
  cancelled: styles.statusCancelled,
};

const CONFIG_TRANSLATION: Record<string, string> = {
  // 键的翻译 (Keys)
  lengthcm: "长度(厘米)",
  weightoz: "重量(盎司)",
  wraptype: "握把类型",
  jointtype: "接牙类型",
  caseoption: "球杆盒",
  finishstyle: "表面涂装",
  tipdiametermm: "皮头直径",

  // 值的翻译 (Values)
  "stainless-steel": "不锈钢",
  titanium: "钛合金",
  "carbon-grip": "碳纤维防滑",
  "genuine-leather": "真皮",
  none: "无",
  basic: "基础软包",
  pro: "专业硬壳",
  true: "是",
  false: "否",
  "matte-carbon":"磨砂碳纹",
  "gloss-carbon":"高亮碳纹",
  "ocean-blue":"海洋蓝",
};

/**
 * 翻译工具函数
 * @param text 原始英文单词
 * @returns 翻译后的中文，如果没有对应翻译则返回原词
 */
const t = (text: string | number | boolean): string => {
  const key = String(text).toLowerCase();
  return CONFIG_TRANSLATION[key] || String(text);
};

const RenderConfiguration = ({ config }: { config: OrderConfiguration }) => {
  if (!config || typeof config !== "object") return null;

  return (
    <div className={styles.configContainer}>
      {Object.entries(config).map(([key, value]) => (
        <div key={key} className={styles.configItem}>
          {/* 翻译键 (Label) */}
          <span className={styles.configLabel}>{t(key)}:</span>

          <span className={styles.configValue}>
            {typeof value === "object" ? (
              // 如果是嵌套对象，递归调用或格式化显示
              <RenderConfiguration config={value as OrderConfiguration} />
            ) : (
              // 翻译值 (Value)
              t(value)
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

function AdminOrderQueryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [inputKeyword, setInputKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async (keyword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get("/admin/orders", {
        params: { keyword },
      });

      if (!response.data.success) {
        setError(response.data.message || "查询失败，请稍后再试。");
        return;
      }

      setOrders((response.data.orders || []) as AdminOrder[]);
    } catch (err) {
      console.error("Failed to query orders:", err);
      setError("无法查询订单信息，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders("");
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = inputKeyword.trim();
    setActiveKeyword(keyword);
    await fetchOrders(keyword);
  };

  const handleReset = async () => {
    setInputKeyword("");
    setActiveKeyword("");
    await fetchOrders("");
  };

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: PoolCueOrder["status"],
  ) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/status`, {
        status: newStatus,
      });

      if (response.data.success) {
        // 更新本地状态
        setOrders(
          orders.map((order) =>
            order.order_id === orderId
              ? { ...order, status: newStatus }
              : order,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("状态更新失败");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>订单信息查询</h1>
        <p className={styles.subtitle}>
          支持按订单 ID、用户名、联系电话、订单状态进行搜索
        </p>

        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input
            type="text"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            placeholder="输入关键词后搜索"
            className={styles.searchInput}
          />
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={isLoading}
          >
            搜索
          </button>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
            disabled={isLoading}
          >
            重置
          </button>
        </form>

        {isLoading && <p className={styles.tip}>正在查询订单信息...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!isLoading && !error && (
          <>
            <p className={styles.resultMeta}>
              {activeKeyword ? `关键词: ${activeKeyword} | ` : ""}共{" "}
              {orders.length} 条结果
            </p>
            <div className={styles.list}>
              {orders.length === 0 ? (
                <p className={styles.empty}>没有匹配的订单。</p>
              ) : (
                orders.map((order) => (
                  <article 
                    key={order.order_id} 
                    className={styles.item}
                    style={{ display: "flex", gap: "20px", alignItems: "flex-start" }} // 新增：左右布局
                  >
                    {/* 左侧：图片展示区 */}
                    <div style={{ width: "160px", flexShrink: 0 }}>
                      {order.customization_mode === "preset" ? (
                        <img 
                          src="/preset_example.jpg" 
                          alt="默认参数球杆" 
                          style={{ width: "100%", height: "auto", borderRadius: "8px", objectFit: "cover" }}
                        />
                      ) : (
                        <img 
                          src={order.design_image_path || "/images/placeholder.jpg"} 
                          alt="自由定制设计图" 
                          style={{ width: "100%", height: "auto", borderRadius: "8px", objectFit: "cover" }}
                        />
                      )}
                    </div>

                    {/* 右侧：订单详情区 */}
                    <div className={styles.itemMain} style={{ flex: 1 }}>
                      <div className={styles.orderHeader}>
                        <p className={styles.name}>
                          订单 #{order.order_id.slice(-8).toUpperCase()}
                          {/* 新增：显示订单类型标签 */}
                          <span style={{ fontSize: "12px", background: "#eee", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px" }}>
                            {order.customization_mode === "preset" ? "参数定制" : "自由定制"}
                          </span>
                          <span
                            className={`${styles.status} ${statusStyleMap[order.status]}`}
                          >
                            {statusTextMap[order.status]}
                          </span>
                        </p>
                        
                        {/* 仅 Preset 订单显示价格 */}
                        {order.customization_mode === "preset" && (
                          <p className={styles.price}>
                            ¥{order.total_price.toFixed(2)}
                          </p>
                        )}
                      </div>

                      <p className={styles.meta}>
                        <strong>产品:</strong> {order.product_name}
                      </p>

                      {/* 差异化显示：配置 vs 描述 */}
                      {order.customization_mode === "preset" ? (
                        <div className={styles.configSection}>
                          <strong>定制参数:</strong>
                          <RenderConfiguration
                            config={order.configuration as OrderConfiguration}
                          />
                        </div>
                      ) : (
                        <div className={styles.configSection} style={{ background: "#f9f9f9", padding: "10px", borderRadius: "6px" }}>
                          <strong>定制描述:</strong>
                          <p style={{ marginTop: "4px", whiteSpace: "pre-wrap", color: "#444" }}>
                            {order.design_description || "客户未填写描述"}
                          </p>
                        </div>
                      )}

                      {/* 公共联系人信息 */}
                      <p className={styles.meta} style={{ marginTop: "12px" }}>
                        <strong>客户:</strong> {order.contact_name} (
                        {order.username || order.user_id})
                      </p>
                      <p className={styles.meta}>
                        <strong>电话:</strong> {order.contact_phone}
                      </p>
                      <p className={styles.meta}>
                        <strong>地址:</strong> {order.shipping_address}
                      </p>
                      {order.order_note && (
                        <p className={styles.meta}>
                          <strong>备注:</strong> {order.order_note}
                        </p>
                      )}
                      <p className={styles.meta}>
                        <strong>创建时间:</strong>{" "}
                        {formatDate(order.created_at)}
                      </p>

                      {/* 状态操作按钮 */}
                      <div className={styles.statusActions}>
                        {order.status === "submitted" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              handleStatusUpdate(order.order_id, "processing")
                            }
                          >
                            开始处理
                          </button>
                        )}
                        {order.status === "processing" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              handleStatusUpdate(order.order_id, "shipped")
                            }
                          >
                            标记发货
                          </button>
                        )}
                        {order.status === "shipped" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              handleStatusUpdate(order.order_id, "completed")
                            }
                          >
                            标记完成
                          </button>
                        )}
                        {(order.status === "submitted" ||
                          order.status === "processing") && (
                          <button
                            className={`${styles.actionBtn} ${styles.danger}`}
                            onClick={() =>
                              handleStatusUpdate(order.order_id, "cancelled")
                            }
                          >
                            取消订单
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminOrderQueryPage;
