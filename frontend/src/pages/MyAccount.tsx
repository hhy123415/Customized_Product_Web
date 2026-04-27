import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import styles from "../css/MyAccount.module.css";
import type { CheckInStatus, User_info, UserWork } from "../Interface";
import { useAuth } from "../hooks/useAuth";

const roleDisplayMap: Record<string, string> = {
  regular: "普通用户",
  admin: "管理员",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

function MyAccount() {
  const { auth, updateAvatar } = useAuth();
  const { userId: routeUserId } = useParams<{ userId?: string }>();

  const targetUserId = useMemo(
    () => (routeUserId ? String(routeUserId) : auth.user_id),
    [routeUserId, auth.user_id],
  );

  const [userInfo, setUserInfo] = useState<User_info | null>(null);
  const [works, setWorks] = useState<UserWork[]>([]);
  const [email, setEmail] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [bioDraft, setBioDraft] = useState<string>("");
  const [newWorkDescription, setNewWorkDescription] = useState<string>("");
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus | null>(
    null,
  );

  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [uploadingWork, setUploadingWork] = useState<boolean>(false);
  const [savingBio, setSavingBio] = useState<boolean>(false);
  const [checkingIn, setCheckingIn] = useState<boolean>(false);

  // --- 消息提示状态分离 ---
  const [message, setMessage] = useState<string>(""); // 全局操作反馈（上传、修改资料等）
  const [checkInMessage, setCheckInMessage] = useState<string>(""); // 仅用于签到的反馈提示

  const fetchProfile = async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      setError(null);
      setMessage("");
      setCheckInMessage(""); // 重置签到消息

      const profileRes = await api.get(`/users/${targetUserId}/profile`);
      if (!profileRes.data.success) {
        throw new Error(profileRes.data.message || "获取用户主页失败");
      }

      setIsOwner(Boolean(profileRes.data.is_owner));
      setUserInfo(profileRes.data.user as User_info);
      setWorks((profileRes.data.works as UserWork[]) || []);
      setBioDraft((profileRes.data.user?.bio as string) || "");

      if (profileRes.data.is_owner) {
        const [myRes, checkInRes] = await Promise.all([
          api.get("/my_info"),
          api.get("/my_info/check-in"),
        ]);
        if (myRes.data.success) {
          setEmail(String(myRes.data.user?.email || ""));
          setPoints(Number(myRes.data.user?.points || 0));
        }
        if (checkInRes.data.success) {
          setCheckInStatus(checkInRes.data.check_in as CheckInStatus);
        }
      } else {
        setEmail("");
        setPoints(0);
        setCheckInStatus(null);
      }
    } catch (err) {
      console.error("Fetch user profile error:", err);
      setError("加载用户主页失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  /** 处理头像上传 */
  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;

    setMessage("");
    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!uploadRes.data?.success || !uploadRes.data?.path) {
        throw new Error(uploadRes.data?.message || "图片上传失败");
      }

      const avatarPath = uploadRes.data.path as string;
      const updateRes = await api.put("/my_info/avatar", {
        img_path: avatarPath,
      });
      if (!updateRes.data?.success) {
        throw new Error(updateRes.data?.message || "头像保存失败");
      }

      setUserInfo((prev) => (prev ? { ...prev, img_path: avatarPath } : prev));
      updateAvatar(avatarPath);
      setMessage("头像更新成功");
    } catch (err) {
      console.error("Avatar upload error:", err);
      setMessage("头像上传失败，请稍后重试");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  /** 保存个人签名 */
  const handleSaveBio = async () => {
    if (!isOwner) return;
    try {
      setSavingBio(true);
      setMessage("");
      const res = await api.put("/my_info/profile", { bio: bioDraft });
      if (!res.data?.success) {
        throw new Error(res.data?.message || "个人签名保存失败");
      }
      setUserInfo((prev) => (prev ? { ...prev, bio: bioDraft.trim() } : prev));
      setMessage("个人签名已保存");
    } catch (err) {
      console.error("Save bio error:", err);
      setMessage("个人签名保存失败，请稍后重试");
    } finally {
      setSavingBio(false);
    }
  };

  /** 每日签到 - 使用独立的 checkInMessage */
  const handleCheckIn = async () => {
    if (!isOwner || checkingIn || !checkInStatus?.can_check_in) return;

    try {
      setCheckingIn(true);
      setCheckInMessage(""); // 清除之前的签到提示
      const res = await api.post("/my_info/check-in");

      if (!res.data?.success) {
        throw new Error(res.data?.message || "签到失败");
      }

      const latestCheckIn = res.data.check_in;
      const currentStreak = Number(latestCheckIn?.streak_count || 1);
      const bonusPoints = Number(latestCheckIn?.bonus_points || 0);
      const totalPoints = Number(latestCheckIn?.total_points || 0);

      setPoints(Number(res.data?.points || 0));
      setCheckInStatus({
        can_check_in: false,
        last_check_in_date: latestCheckIn?.check_in_date || null,
        current_streak: currentStreak,
        today_base_points: Number(latestCheckIn?.base_points || 0),
        today_bonus_points: bonusPoints,
        today_total_points: totalPoints,
      });

      // 设置签到专属消息
      setCheckInMessage(
        `签到成功，获得 ${totalPoints} 积分${bonusPoints > 0 ? `（含连续签到奖励 ${bonusPoints} 积分）` : ""}`,
      );
    } catch (err) {
      console.error("Check-in error:", err);
      const alreadyCheckedIn =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof err.response === "object" &&
        err.response !== null &&
        "status" in err.response &&
        err.response.status === 409;

      if (alreadyCheckedIn) {
        setCheckInMessage("今天已经签到过了");
        // 尝试刷新状态同步 UI
        try {
          const [myRes, checkInRes] = await Promise.all([
            api.get("/my_info"),
            api.get("/my_info/check-in"),
          ]);
          if (myRes.data.success)
            setPoints(Number(myRes.data.user?.points || 0));
          if (checkInRes.data.success)
            setCheckInStatus(checkInRes.data.check_in as CheckInStatus);
        } catch (refreshErr) {
          console.error("Refresh error:", refreshErr);
        }
      } else {
        setCheckInMessage("签到失败，请稍后重试");
      }
    } finally {
      setCheckingIn(false);
    }
  };

  /** 上传作品 */
  const handleWorkUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;

    setMessage("");
    try {
      setUploadingWork(true);
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await api.post("/images/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!uploadRes.data?.success || !uploadRes.data?.path) {
        throw new Error(uploadRes.data?.message || "作品图片上传失败");
      }

      const saveRes = await api.post("/my_info/works", {
        image_path: uploadRes.data.path,
        description: newWorkDescription,
      });
      if (!saveRes.data?.success) {
        throw new Error(saveRes.data?.message || "作品保存失败");
      }

      const createdWork = saveRes.data.work as UserWork;
      setWorks((prev) => [createdWork, ...prev]);
      setNewWorkDescription("");
      setMessage("作品上传成功");
    } catch (err) {
      console.error("Upload work error:", err);
      setMessage("作品上传失败，请稍后重试");
    } finally {
      setUploadingWork(false);
      event.target.value = "";
    }
  };

  /** 删除作品 */
  const handleDeleteWork = async (workId: string) => {
    if (!isOwner) return;
    try {
      setMessage("");
      const res = await api.delete(`/my_info/works/${workId}`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "删除作品失败");
      }
      setWorks((prev) => prev.filter((work) => work.work_id !== workId));
      setMessage("作品已删除");
    } catch (err) {
      console.error("Delete work error:", err);
      setMessage("删除作品失败，请稍后重试");
    }
  };

  if (loading)
    return (
      <div className={styles.container}>
        <p>加载中...</p>
      </div>
    );
  if (error || !userInfo)
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>
          错误: {error || "未能加载用户信息。"}
        </p>
      </div>
    );

  const avatarSrc = userInfo.img_path || "/default-avatar.png";

  return (
    <div className={styles.container}>
      <h2>{isOwner ? "个人中心" : `${userInfo.username} 的主页`}</h2>

      <div className={styles.userInfoCard}>
        <div className={styles.avatarSection}>
          <img src={avatarSrc} alt="用户头像" className={styles.avatarImage} />
          {isOwner && (
            <label className={styles.avatarUploadButton}>
              {uploadingAvatar ? "上传中..." : "修改头像"}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className={styles.hiddenInput}
                disabled={uploadingAvatar}
              />
            </label>
          )}
        </div>

        <p>
          <strong>用户名:</strong> {userInfo.username}
          {userInfo.is_certified_designer && (
            <img
              src="/designer_icon.png"
              alt="认证设计师"
              style={{
                height: "20px",
                marginLeft: "8px",
                verticalAlign: "middle",
              }}
            />
          )}
        </p>

        {isOwner && (
          <p>
            <strong>用户邮箱:</strong> {email}
          </p>
        )}
        <p>
          <strong>账号类型:</strong>{" "}
          {roleDisplayMap[userInfo.role] || userInfo.role}
        </p>
        <p>
          <strong>当前积分:</strong>{" "}
          <span style={{ color: "#27ae60", fontWeight: "bold" }}>
            {points ?? 0}
          </span>
        </p>

        {/* --- 签到区域：独立消息显示 --- */}
        {isOwner && checkInStatus && (
          <div className={styles.checkInCard}>
            <div className={styles.checkInHeader}>
              <strong>每日签到</strong>
              <span className={styles.checkInStreak}>
                已连续签到 {checkInStatus.current_streak} 天
              </span>
            </div>
            <p className={styles.checkInText}>
              连续签到可额外获得积分奖励，快来坚持签到吧！
            </p>
            <p className={styles.checkInText}>
              {checkInStatus.can_check_in
                ? "今天还没有签到。"
                : `今天已签到${checkInStatus.last_check_in_date ? `（${checkInStatus.last_check_in_date}）` : ""}。`}
            </p>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleCheckIn}
              disabled={!checkInStatus.can_check_in || checkingIn}
            >
              {checkingIn
                ? "签到中..."
                : checkInStatus.can_check_in
                  ? "立即签到"
                  : "今日已签到"}
            </button>
            {/* 签到专属消息：显示在签到卡片底部 */}
            {checkInMessage && (
              <p
                className={styles.uploadMessage}
                style={{ marginTop: "10px", color: "#27ae60" }}
              >
                {checkInMessage}
              </p>
            )}
          </div>
        )}

        <div className={styles.bioBlock}>
          <strong>个人签名:</strong>
          {isOwner ? (
            <>
              <textarea
                className={styles.bioTextarea}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                maxLength={500}
                placeholder="介绍一下自己吧..."
              />
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleSaveBio}
                disabled={savingBio}
              >
                {savingBio ? "保存中..." : "保存签名"}
              </button>
            </>
          ) : (
            <p className={styles.bioText}>
              {userInfo.bio || "这个人很神秘，暂时没有留下签名。"}
            </p>
          )}
        </div>

        <div className={styles.workSection}>
          <h3>作品展示</h3>
          {isOwner && (
            <div className={styles.workUploadArea}>
              <textarea
                className={styles.workDescriptionInput}
                value={newWorkDescription}
                onChange={(e) => setNewWorkDescription(e.target.value)}
                maxLength={200}
                placeholder="可选：给作品写一句说明（200字内）"
              />
              <label className={styles.avatarUploadButton}>
                {uploadingWork ? "上传中..." : "上传作品图片"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleWorkUpload}
                  className={styles.hiddenInput}
                  disabled={uploadingWork}
                />
              </label>
            </div>
          )}

          {works.length === 0 ? (
            <p className={styles.emptyText}>
              {isOwner
                ? "你还没有上传作品，快来展示一下吧。"
                : "TA 还没有公开作品。"}
            </p>
          ) : (
            <div className={styles.workGrid}>
              {works.map((work) => (
                <div key={work.work_id} className={styles.workCard}>
                  <img
                    src={work.image_path}
                    alt="..."
                    className={styles.workImage}
                  />
                  <div style={{ padding: "16px" }}>
                    {" "}
                    {/* 或者使用 class 控制 */}
                    <p className={styles.workMeta}>
                      {formatDate(work.created_at)}
                    </p>
                    {work.description && (
                      <p className={styles.workDescription}>
                        {work.description}
                      </p>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => handleDeleteWork(work.work_id)}
                      >
                        删除作品
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作反馈消息（现在仅处理头像、签名、作品增删等全局操作） */}
        {message && <p className={styles.uploadMessage}>{message}</p>}
      </div>
    </div>
  );
}

export default MyAccount;
