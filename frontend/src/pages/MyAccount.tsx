import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import styles from "../css/MyAccount.module.css";
import type { User_info, UserWork } from "../Interface";
import { useAuth } from "../hooks/useAuth";

const roleDisplayMap: Record<string, string> = {
  regular: "普通用户",
  enterprise: "企业用户",
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
  const [bioDraft, setBioDraft] = useState<string>("");
  const [newWorkDescription, setNewWorkDescription] = useState<string>("");

  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [uploadingWork, setUploadingWork] = useState<boolean>(false);
  const [savingBio, setSavingBio] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const fetchProfile = async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      setError(null);
      setMessage("");

      const profileRes = await api.get(`/users/${targetUserId}/profile`);
      if (!profileRes.data.success) {
        throw new Error(profileRes.data.message || "获取用户主页失败");
      }

      setIsOwner(Boolean(profileRes.data.is_owner));
      setUserInfo(profileRes.data.user as User_info);
      setWorks((profileRes.data.works as UserWork[]) || []);
      setBioDraft((profileRes.data.user?.bio as string) || "");

      if (profileRes.data.is_owner) {
        const myRes = await api.get("/my_info");
        if (myRes.data.success) {
          setEmail(String(myRes.data.user?.email || ""));
        }
      } else {
        setEmail("");
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
      const updateRes = await api.put("/my_info/avatar", { img_path: avatarPath });
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

  if (loading) {
    return (
      <div className={styles.container}>
        <p>加载中...</p>
      </div>
    );
  }

  if (error || !userInfo) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>错误: {error || "未能加载用户信息。"}</p>
      </div>
    );
  }

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
        </p>
        {isOwner && (
          <p>
            <strong>用户邮箱:</strong> {email}
          </p>
        )}
        <p>
          <strong>账号类型:</strong> {roleDisplayMap[userInfo.role] || userInfo.role}
        </p>

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
            <p className={styles.bioText}>{userInfo.bio || "这个人很神秘，暂时没有留下签名。"}</p>
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
              {isOwner ? "你还没有上传作品，快来展示一下吧。" : "TA 还没有公开作品。"}
            </p>
          ) : (
            <div className={styles.workGrid}>
              {works.map((work) => (
                <div key={work.work_id} className={styles.workCard}>
                  <img
                    src={work.image_path}
                    alt={work.description || "用户作品"}
                    className={styles.workImage}
                  />
                  <p className={styles.workMeta}>{formatDate(work.created_at)}</p>
                  {work.description && (
                    <p className={styles.workDescription}>{work.description}</p>
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
              ))}
            </div>
          )}
        </div>

        {message && <p className={styles.uploadMessage}>{message}</p>}
      </div>
    </div>
  );
}

export default MyAccount;
