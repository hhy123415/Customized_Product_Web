import { useEffect, useState, type FormEvent } from "react";
import api from "../api/axios";
import type { AdminOrder } from "../Interface";
import styles from "../css/AdminUserQuery.module.css";
import {
  formatDate,
  RenderConfiguration,
  statusStyleMap,
  statusTextMap,
  type OrderConfiguration,
  type OrderStatus,
} from "./orderQueryShared";

function AdminOrderQueryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [inputKeyword, setInputKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatingId, setEstimatingId] = useState<string | null>(null);
  const [estimateForm, setEstimateForm] = useState({
    total_price: "",
    estimate_note: "",
  });

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
    newStatus: OrderStatus,
  ) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/status`, {
        status: newStatus,
      });

      if (response.data.success) {
        setOrders((currentOrders) =>
          currentOrders.map((order) =>
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

  const handleEstimateSubmit = async (orderId: string) => {
    const totalPrice = parseFloat(estimateForm.total_price);
    if (!totalPrice || totalPrice <= 0) {
      alert("请输入有效的价格");
      return;
    }
    try {
      const response = await api.patch(`/admin/orders/${orderId}/estimate`, {
        total_price: totalPrice,
        pricing_lines: [],
        estimate_note: estimateForm.estimate_note,
      });
      if (response.data.success) {
        fetchOrders(activeKeyword); // 刷新列表
        setEstimatingId(null);
        setEstimateForm({ total_price: "", estimate_note: "" });
      }
    } catch (err) {
      console.error("估价失败", err);
      alert("估价失败，请稍后再试");
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
              {activeKeyword ? `关键词 ${activeKeyword} | ` : ""}共{" "}
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
                    style={{
                      display: "flex",
                      gap: "20px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ width: "160px", flexShrink: 0 }}>
                      <img
                        src={
                          order.design_image_path || "/images/placeholder.jpg"
                        }
                        alt="自由定制设计图"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                    </div>

                    <div className={styles.itemMain} style={{ flex: 1 }}>
                      <div className={styles.orderHeader}>
                        <p className={styles.name}>
                          订单 #{order.order_id.slice(-8).toUpperCase()}
                          <span
                            style={{
                              fontSize: "12px",
                              background: "#eee",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              marginLeft: "8px",
                            }}
                          >
                            {order.customization_mode === "preset"
                              ? "参数定制"
                              : "自由定制"}
                          </span>
                          <span
                            className={`${styles.status} ${statusStyleMap[order.status]}`}
                          >
                            {statusTextMap[order.status]}
                          </span>
                        </p>

                        {order.customization_mode === "preset" && (
                          <p className={styles.price}>
                            ￥{order.total_price.toFixed(2)}
                          </p>
                        )}

                        {order.customization_mode === "freeform" &&
                          order.total_price > 0 && (
                            <div
                              style={{
                                background: "#f0f7ff",
                                padding: "10px",
                                borderRadius: "6px",
                                marginTop: "8px",
                              }}
                            >
                              <p className={styles.meta}>
                                <strong>报价:</strong> ￥
                                {order.total_price.toFixed(2)}
                              </p>
                              {order.estimate_note && (
                                <p className={styles.meta}>
                                  <strong>估价备注:</strong>{" "}
                                  {order.estimate_note}
                                </p>
                              )}
                            </div>
                          )}
                      </div>

                      <p className={styles.meta}>
                        <strong>产品:</strong> {order.product_name}
                      </p>

                      {order.customization_mode === "preset" ? (
                        <div className={styles.configSection}>
                          <strong>定制参数:</strong>
                          <RenderConfiguration
                            config={order.configuration as OrderConfiguration}
                          />
                        </div>
                      ) : (
                        <div
                          className={styles.configSection}
                          style={{
                            background: "#f9f9f9",
                            padding: "10px",
                            borderRadius: "6px",
                          }}
                        >
                          <strong>定制描述:</strong>
                          <p
                            style={{
                              marginTop: "4px",
                              whiteSpace: "pre-wrap",
                              color: "#444",
                            }}
                          >
                            {order.design_description || "客户未填写描述"}
                          </p>
                        </div>
                      )}

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
                        {order.status === "submitted" &&
                          order.customization_mode === "freeform" && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => {
                                setEstimatingId(order.order_id);
                                setEstimateForm({
                                  total_price: "",
                                  estimate_note: "",
                                });
                              }}
                            >
                              评估定价
                            </button>
                          )}
                          
                        {order.status === "quoted" && (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => {
                                setEstimatingId(order.order_id);
                                setEstimateForm({
                                  total_price: order.total_price
                                    ? String(order.total_price)
                                    : "",
                                  estimate_note: order.estimate_note || "",
                                });
                              }}
                            >
                              重新估价
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.danger}`}
                              onClick={() =>
                                handleStatusUpdate(order.order_id, "cancelled")
                              }
                            >
                              取消订单
                            </button>
                          </>
                        )}

                        {estimatingId === order.order_id && (
                          <div
                            style={{
                              marginTop: "10px",
                              padding: "10px",
                              background: "#f9f9f9",
                              borderRadius: "6px",
                            }}
                          >
                            <input
                              type="number"
                              placeholder="总价（元）"
                              value={estimateForm.total_price}
                              onChange={(e) =>
                                setEstimateForm((prev) => ({
                                  ...prev,
                                  total_price: e.target.value,
                                }))
                              }
                              style={{
                                padding: "6px 8px",
                                marginRight: "8px",
                                width: "120px",
                              }}
                            />
                            <input
                              type="text"
                              placeholder="备注（选填）"
                              value={estimateForm.estimate_note}
                              onChange={(e) =>
                                setEstimateForm((prev) => ({
                                  ...prev,
                                  estimate_note: e.target.value,
                                }))
                              }
                              style={{
                                padding: "6px 8px",
                                marginRight: "8px",
                                width: "180px",
                              }}
                            />
                            <button
                              className={styles.actionBtn}
                              onClick={() =>
                                handleEstimateSubmit(order.order_id)
                              }
                            >
                              提交估价
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.danger}`}
                              onClick={() => setEstimatingId(null)}
                            >
                              取消
                            </button>
                          </div>
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
