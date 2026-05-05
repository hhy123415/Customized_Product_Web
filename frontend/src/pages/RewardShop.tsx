import React, { useEffect, useState } from "react";
import REWARDS_LIST from "../assets/rewards";
import type { RewardItem } from "../assets/rewards";
import { useAuth } from "../hooks/useAuth";
import api from "../api/axios";
import axios from "axios";
import styles from "../css/RewardShop.module.css";
import { Link } from "react-router-dom";

const RewardShop: React.FC = () => {
  const { auth } = useAuth();
  const [userPoints, setUserPoints] = useState<number>(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [selected, setSelected] = useState<RewardItem | null>(null);
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    shipping_address: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 获取用户积分
  const fetchPoints = async () => {
    try {
      const res = await api.get("/my_info");
      setUserPoints(res.data.user?.points ?? 0);
    } catch (err) {
      console.error("获取积分失败", err);
    } finally {
      setLoadingPoints(false);
    }
  };

  useEffect(() => {
    if (auth.isLoggedIn) {
      fetchPoints();
    }
  }, [auth.isLoggedIn]);

  const handleOpenModal = (item: RewardItem) => {
    setSelected(item);
    setError("");
    setSuccess(false);
    setForm({
      contact_name: "",
      contact_phone: "",
      shipping_address: "",
      note: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await api.post("/redeem", {
        reward_id: selected.id,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        shipping_address: form.shipping_address,
        note: form.note,
      });

      if (typeof res.data.points_after === "number") {
        setUserPoints(res.data.points_after);
      } else {
        fetchPoints();
      }

      setSuccess(true);
      setSelected(null);
    } catch (err: unknown) {
      let message = "兑换失败，请稍后重试";
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message = err.response.data.message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPoints) {
    return <div className={styles.loading}>加载中...</div>;
  }

  return (
    <div className={styles["reward-shop"]}>
      <h1>积分兑换</h1>
      <Link to="/redemptions/history" className={styles["history-link"]}>
        兑换记录
      </Link>
      <p className={styles.points}>当前积分：{userPoints}</p>

      <div className={styles["reward-grid"]}>
        {REWARDS_LIST.map((item) => {
          const disabled = userPoints < item.pointsRequired;
          return (
            <div className={styles["reward-card"]} key={item.id}>
              <div className={styles["image-wrapper"]}>
                <img src={item.image} alt={item.name} />
              </div>
              <h3>{item.name}</h3>
              <p className={styles.desc}>{item.description}</p>
              <div className={styles.cost}>{item.pointsRequired} 积分</div>
              <button disabled={disabled} onClick={() => handleOpenModal(item)}>
                {disabled ? "积分不足" : "立即兑换"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 兑换表单弹窗 */}
      {selected && (
        <div
          className={styles["modal-overlay"]}
          onClick={() => setSelected(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>兑换 {selected.name}</h2>
            <p>
              需要 {selected.pointsRequired} 积分，您的积分：{userPoints}
            </p>

            <form onSubmit={handleSubmit}>
              <label>
                收货人
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) =>
                    setForm({ ...form, contact_name: e.target.value })
                  }
                  required
                  maxLength={80}
                />
              </label>
              <label>
                联系电话
                <input
                  type="text"
                  value={form.contact_phone}
                  onChange={(e) =>
                    setForm({ ...form, contact_phone: e.target.value })
                  }
                  required
                  maxLength={30}
                />
              </label>
              <label>
                收货地址
                <textarea
                  value={form.shipping_address}
                  onChange={(e) =>
                    setForm({ ...form, shipping_address: e.target.value })
                  }
                  required
                  maxLength={500}
                />
              </label>
              <label>
                备注（选填）
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  maxLength={200}
                />
              </label>

              {error && <p className={styles["error-msg"]}>{error}</p>}
              {success && (
                <p className={styles["success-msg"]}>兑换提交成功！</p>
              )}

              <div className={styles["modal-btns"]}>
                <button type="submit" disabled={submitting}>
                  {submitting ? "提交中..." : "确认兑换"}
                </button>
                <button type="button" onClick={() => setSelected(null)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardShop;
