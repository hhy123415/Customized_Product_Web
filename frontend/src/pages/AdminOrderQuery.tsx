import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { AdminOrder } from "../Interface";
import styles from "../css/AdminUserQuery.module.css"; // 复用相同样式

interface PoolCueOrder {
  order_id: string;
  user_id: string;
  product_name: string;
  configuration: unknown;
  pricing_lines: unknown[];
  total_price: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  order_note: string | null;
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
                  <article key={order.order_id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <div className={styles.orderHeader}>
                        <p className={styles.name}>
                          订单 #{order.order_id.slice(-8).toUpperCase()}
                          <span
                            className={`${styles.status} ${statusStyleMap[order.status]}`}
                          >
                            {statusTextMap[order.status]}
                          </span>
                        </p>
                        <p className={styles.price}>
                          ¥{order.total_price.toFixed(2)}
                        </p>
                      </div>

                      <p className={styles.meta}>
                        <strong>产品:</strong> {order.product_name}
                      </p>
                      <p className={styles.meta}>
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
