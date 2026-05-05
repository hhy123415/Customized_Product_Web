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
} from "./orderQueryShared";

function UserOrderQueryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [inputKeyword, setInputKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchOrders = async (keyword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get("/orders/my", {
        params: { keyword },
      });

      if (!response.data.success) {
        setError(response.data.message || "查询失败，请稍后再试。");
        return;
      }

      setOrders((response.data.orders || []) as AdminOrder[]);
    } catch (err) {
      console.error("Failed to query user orders:", err);
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

  const handleCancelOrder = async (orderId: string) => {
    setActionOrderId(orderId);
    try {
      const response = await api.patch(`/orders/${orderId}/cancel`);
      if (!response.data.success) {
        alert(response.data.message || "取消订单失败");
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === orderId
            ? { ...order, status: "cancelled" }
            : order,
        ),
      );
    } catch (err) {
      console.error("Failed to cancel order:", err);
      alert("取消订单失败，请稍后再试");
    } finally {
      setActionOrderId(null);
    }
  };

  const handleAcceptQuote = async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/accept-quote`);
      if (res.data.success) {
        setOrders((prev) =>
          prev.map((o) => (o.order_id === orderId ? res.data.order : o)),
        );
      } else {
        alert(res.data.message || "操作失败");
      }
    } catch (err) {
      console.error("accept error", err);
      alert("接受报价失败");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectQuote = async (orderId: string) => {
    if (!window.confirm("确定要拒绝该报价吗？订单将取消。")) return;
    setRejectingId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/reject-quote`);
      if (res.data.success) {
        setOrders((prev) =>
          prev.map((o) => (o.order_id === orderId ? res.data.order : o)),
        );
      } else {
        alert(res.data.message || "操作失败");
      }
    } catch (err) {
      console.error("reject error", err);
      alert("拒绝报价失败");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>我的订单</h1>
        <p className={styles.subtitle}>
          支持按订单 ID、产品名称、联系电话、订单状态查询你自己的订单
        </p>

        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input
            type="text"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            placeholder="输入订单号、产品名、电话或状态"
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

        {isLoading && <p className={styles.tip}>正在查询你的订单...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!isLoading && !error && (
          <>
            <p className={styles.resultMeta}>
              {activeKeyword ? `关键词 ${activeKeyword} | ` : ""}共{" "}
              {orders.length} 条结果
            </p>
            <div className={styles.list}>
              {orders.length === 0 ? (
                <p className={styles.empty}>你当前还没有匹配的订单。</p>
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
                      {order.customization_mode === "preset" ? (
                        <img
                          src="/preset_example.jpg"
                          alt="参数定制球杆"
                          style={{
                            width: "100%",
                            height: "auto",
                            borderRadius: "8px",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
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
                      )}
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
                                background: "#eef6ff",
                                padding: "10px",
                                borderRadius: "6px",
                                marginTop: "8px",
                              }}
                            >
                              <p className={styles.meta}>
                                <strong>商家报价:</strong> ￥
                                {order.total_price.toFixed(2)}
                              </p>
                              {order.estimate_note && (
                                <p className={styles.meta}>
                                  <strong>备注:</strong> {order.estimate_note}
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
                            {order.design_description || "你还没有填写描述"}
                          </p>
                        </div>
                      )}

                      <p className={styles.meta} style={{ marginTop: "12px" }}>
                        <strong>收货人:</strong> {order.contact_name}
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
                      <p className={styles.meta}>
                        <strong>最后更新:</strong>{" "}
                        {formatDate(order.updated_at)}
                      </p>

                      {(order.status === "submitted" ||
                        order.status === "processing") && (
                        <div className={styles.statusActions}>
                          <button
                            className={`${styles.actionBtn} ${styles.danger}`}
                            onClick={() => handleCancelOrder(order.order_id)}
                            disabled={actionOrderId === order.order_id}
                          >
                            {actionOrderId === order.order_id
                              ? "取消中..."
                              : "取消订单"}
                          </button>
                        </div>
                      )}

                      {order.status === "quoted" && (
                        <div className={styles.statusActions}>
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleAcceptQuote(order.order_id)}
                            disabled={acceptingId === order.order_id}
                          >
                            {acceptingId === order.order_id
                              ? "处理中..."
                              : "接受报价"}
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.danger}`}
                            onClick={() => handleRejectQuote(order.order_id)}
                            disabled={rejectingId === order.order_id}
                          >
                            {rejectingId === order.order_id
                              ? "处理中..."
                              : "拒绝报价"}
                          </button>
                        </div>
                      )}
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

export default UserOrderQueryPage;
