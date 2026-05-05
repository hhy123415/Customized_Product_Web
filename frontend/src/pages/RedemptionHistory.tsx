import React, { useEffect, useState } from "react";
import api from "../api/axios";
import styles from "../css/RedemptionHistory.module.css"; // 新建样式文件
import { AxiosError } from "axios";

interface RedemptionRecord {
  redemption_id: number;
  reward_name: string;
  points_deducted: number;
  contact_name: string;
  contact_phone: string;
  shipping_address: string;
  note: string | null;
  redeemed_at: string;
}

const RedemptionHistory: React.FC = () => {
  const [records, setRecords] = useState<RedemptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await api.get("/my_info/redemptions");
        setRecords(res.data.redemptions ?? []);
      } catch (err: unknown) {
        if (err instanceof AxiosError) {
          setError(err.response?.data?.message);
        } else {
          setError("获取兑换记录失败");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  if (loading) return <div className={styles.loading}>加载中...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <h1>兑换记录</h1>
      {records.length === 0 ? (
        <p className={styles.empty}>暂无兑换记录</p>
      ) : (
        <div className={styles.list}>
          {records.map((r) => (
            <div key={r.redemption_id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>{r.reward_name}</h3>
                <span className={styles.points}>-{r.points_deducted} 积分</span>
              </div>
              <p className={styles.time}>
                {new Date(r.redeemed_at).toLocaleString()}
              </p>
              <div className={styles.details}>
                <p>收货人：{r.contact_name}</p>
                <p>电话：{r.contact_phone}</p>
                <p>地址：{r.shipping_address}</p>
                {r.note && <p>备注：{r.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RedemptionHistory;
