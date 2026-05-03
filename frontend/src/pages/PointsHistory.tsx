import { useEffect, useState } from "react";
import api from "../api/axios";
import type { PointRecordRow } from "../Interface";
import styles from "../css/PointsHistory.module.css";
import { AxiosError } from "axios";

const PointsHistory = () => {
  const [records, setRecords] = useState<PointRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/my_info/points/records");
      if (res.data.success) {
        setRecords(res.data.records || []);
      } else {
        throw new Error(res.data.message || "获取记录失败");
      }
    } catch (err: unknown) {
      let message = "加载失败，请稍后重试";

      if (err instanceof AxiosError) {
        message = err.response?.data?.message || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", { hour12: false });
  };

  if (loading) return <div className={styles.container}>加载中...</div>;
  if (error)
    return (
      <div className={styles.container} style={{ color: "red" }}>
        错误：{error}
      </div>
    );

  return (
    <div className={styles.container}>
      <h2>积分明细</h2>
      {records.length === 0 ? (
        <p>暂无积分变动记录。</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>变动</th>
                <th>余额</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.record_id}>
                  <td>{formatDate(r.created_at)}</td>
                  <td
                    style={{
                      color: r.points_change >= 0 ? "#27ae60" : "#e74c3c",
                      fontWeight: "bold",
                    }}
                  >
                    {r.points_change > 0 ? "+" : ""}
                    {r.points_change}
                  </td>
                  <td>{r.points_after}</td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PointsHistory;
