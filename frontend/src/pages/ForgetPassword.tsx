import styles from "../css/ForgetPassword.module.css";
import  { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";


//后续可以添加邮箱验证码
function Forget() {
  // 0: 输入用户名和邮箱, 1: 输入新密码, 2: 成功/失败结果
  const [stage, setStage] = useState(0);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false); // 用于禁用按钮，防止重复提交

  const navigate = useNavigate();

  // 处理第一阶段的“下一步”按钮点击
  const handleStageOneSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!username || !email) {
      setErrorMessage("请输入用户名和邮箱");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/forget1", { username, email });
      if (response.data.success) {
        setStage(1); // 进入下一阶段
      } else {
        setErrorMessage(response.data.message || "用户名或邮箱不正确。");
      }
    } catch (error) {
      setErrorMessage("验证失败，请稍后再试。");
      console.error("Error verifying user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理第二阶段的“确定”按钮点击（修改密码）
  const handleStageTwoSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!newPassword || !confirmPassword) {
      setErrorMessage("请输入新密码并确认。");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("新密码和确认密码不一致。");
      return;
    }

    // 可以在这里添加一些密码复杂度的前端验证
    if (newPassword.length < 6) {
      setErrorMessage("密码长度至少为6位。");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/forget2", { username, newPassword });
      if (response.data.success) {
        setSuccessMessage(
          response.data.message || "密码修改成功！您可以关闭此页面或返回登录。",
        );
        setStage(2); // 进入结果阶段
      } else {
        setErrorMessage(response.data.message || "密码修改失败，请重试。");
      }
    } catch (error) {
      setErrorMessage("修改密码失败，请稍后再试。");
      console.error("Error resetting password:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染第一阶段的UI
  const renderStageOne = () => (
    <>
      <h2 className={styles.title}>重置密码 (1/2)</h2>
      <div className={styles.fieldGroup}>
        <label htmlFor="username" className={styles.label}>
          用户名:
        </label>
        <input
          type="text"
          id="username"
          className={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入您的用户名"
          disabled={isLoading}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor="email" className={styles.label}>
          邮箱:
        </label>
        <input
          type="email"
          id="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="请输入您注册时使用的邮箱"
          disabled={isLoading}
        />
      </div>
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={handleStageOneSubmit}
          disabled={isLoading}
        >
          {isLoading ? "验证中..." : "下一步"}
        </button>
      </div>
    </>
  );

  // 渲染第二阶段的UI
  const renderStageTwo = () => (
    <>
      <h2 className={styles.title}>重置密码 (2/2)</h2>
      <div className={styles.fieldGroup}>
        <label htmlFor="newPassword" className={styles.label}>
          新密码:
        </label>
        <input
          type="password"
          id="newPassword"
          className={styles.input}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="请输入您的新密码"
          disabled={isLoading}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor="confirmPassword" className={styles.label}>
          确认新密码:
        </label>
        <input
          type="password"
          id="confirmPassword"
          className={styles.input}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="请再次输入您的新密码"
          disabled={isLoading}
        />
      </div>
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => {
            setStage(0); // 返回上一阶段
            setErrorMessage(""); // 清除错误信息
            setNewPassword(""); // 清除密码输入
            setConfirmPassword(""); // 清除确认密码
          }}
          disabled={isLoading}
        >
          上一步
        </button>
        <button
          className={`${styles.button} ${styles.primaryButton}`}
          onClick={handleStageTwoSubmit}
          disabled={isLoading}
        >
          {isLoading ? "提交中..." : "确定"}
        </button>
      </div>
    </>
  );

  // 渲染结果阶段的UI
  const renderResultStage = () => (
    <>
      <h2 className={styles.title}>密码重置结果</h2>
      {successMessage && (
        <p className={styles.successMessage}>{successMessage}</p>
      )}
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      <div className={styles.buttonGroup}>
        {/* 这里可以添加一个返回登录页面的按钮 */}
        <button
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={() => {
            setStage(0);
            setUsername("");
            setEmail("");
            setNewPassword("");
            setConfirmPassword("");
            setErrorMessage("");
            setSuccessMessage("");
            navigate("/login");
          }}
        >
          返回登录
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.container}>
      <div className={styles.contentBox}>
        {stage === 0 && renderStageOne()}
        {stage === 1 && renderStageTwo()}
        {stage === 2 && renderResultStage()}
      </div>
    </div>
  );
}

export default Forget;
