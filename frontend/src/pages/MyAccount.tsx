import { useEffect, useState } from "react";
import api from "../api/axios";
import styles from "../css/MyAccount.module.css";
import type { User_info } from "../Interface";
import { useAuth } from "../hooks/useAuth";

const roleDisplayMap: Record<string, string> = {
  regular: "普通用户",
  enterprise: "企业用户",
  admin: "管理员",
};

function MyAccount() {
  const { updateAvatar } = useAuth();
  const [userInfo, setUserInfo] = useState<User_info | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get("/my_info");
        if (res.data.success) {
          setUserInfo(res.data.user);
        } else {
          setError(res.data.message || "获取用户信息失败。");
        }
      } catch (err) {
        console.error("Fetch user info error:", err);
        setError("网络错误或服务器无响应。");
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadMessage("");

    try {
      setUploading(true);
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
      setUploadMessage("头像更新成功");
    } catch (err) {
      console.error("Avatar upload error:", err);
      setUploadMessage("头像上传失败，请稍后重试");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>错误: {error}</p>
        <p>请确保您已登录。</p>
      </div>
    );
  }

  if (!userInfo) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>未能加载用户信息。</p>
      </div>
    );
  }

  const avatarSrc = userInfo.img_path || "/default-avatar.png";

  return (
    <div className={styles.container}>
      <h2>我的账户</h2>
      <div className={styles.userInfoCard}>
        <div className={styles.avatarSection}>
          <img src={avatarSrc} alt="用户头像" className={styles.avatarImage} />
          <label className={styles.avatarUploadButton}>
            {uploading ? "上传中..." : "修改头像"}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className={styles.hiddenInput}
              disabled={uploading}
            />
          </label>
          {uploadMessage && <p className={styles.uploadMessage}>{uploadMessage}</p>}
        </div>
        <p>
          <strong>用户名:</strong> {userInfo.username}
        </p>
        <p>
          <strong>用户邮箱:</strong> {userInfo.email}
        </p>
        <p>
          <strong>账号类型:</strong> {roleDisplayMap[userInfo.role] || userInfo.role}
        </p>
      </div>
    </div>
  );
}

export default MyAccount;
