import { useState } from "react";
import type { ChangeEvent, SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axios";
import style from "../css/Register.module.css";

type Role = "regular" | "admin";

interface FormData {
  username: string;
  password: string;
  email: string;
  registerCode: string;
  verificationCode: string;
}

interface Errors extends Partial<FormData> {
  submit?: string;
}

interface RegisterResponse {
  success: boolean;
  message?: string;
}

const roleLabelMap: Record<Role, string> = {
  regular: "普通用户",
  admin: "管理员",
};

function Register() {
  const [role, setRole] = useState<Role>("regular");
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    email: "",
    registerCode: "",
    verificationCode: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSendingCode, setIsSendingCode] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [codeSent, setCodeSent] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setErrors({});
    setFormData((prev) => ({ ...prev, registerCode: "" }));
  };

  // 发送验证码
  const handleSendVerificationCode = async () => {
    if (!formData.email) {
      setErrors({ email: "请输入邮箱地址" });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrors({ email: "邮箱格式不正确" });
      return;
    }

    setIsSendingCode(true);
    setErrors({});

    try {
      const response = await api.post("/send-verification-code", {
        email: formData.email,
      });

      if (response.data.success) {
        setCodeSent(true);
        // 开始60秒倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        alert("验证码已发送到您的邮箱，请查收");
      } else {
        setErrors({ submit: response.data.message || "发送验证码失败" });
      }
    } catch (error) {
      console.error("发送验证码失败:", error);
      if (axios.isAxiosError(error)) {
        setErrors({
          submit: error.response?.data?.message || "发送验证码失败",
        });
      } else {
        setErrors({ submit: "无法连接至服务器" });
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): Errors => {
    const newErrors: Errors = {};

    if (!formData.username.trim()) {
      newErrors.username = "请输入用户名";
    }

    if (!formData.password) {
      newErrors.password = "请输入密码";
    } else if (formData.password.length < 6) {
      newErrors.password = "密码长度至少 6 位";
    }

    if (!formData.email) {
      newErrors.email = "请输入邮箱";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "邮箱格式不正确";
      }
    }

    if (!formData.verificationCode.trim()) {
      newErrors.verificationCode = "请输入邮箱验证码";
    } else if (formData.verificationCode.length !== 6) {
      newErrors.verificationCode = "验证码必须是6位数字";
    }

    if (role === "admin" && !formData.registerCode.trim()) {
      newErrors.registerCode = "请输入管理员专用注册码";
    }

    return newErrors;
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<RegisterResponse>("/register", {
        ...formData,
        role,
      });

      if (response.data.success) {
        alert(`${roleLabelMap[role]}注册成功，请重新登录`);
        navigate("/login");
      } else {
        setErrors({ submit: response.data.message || "注册失败" });
      }
    } catch (error) {
      console.error("注册失败:", error);
      if (axios.isAxiosError(error)) {
        setErrors({
          submit: error.response?.data?.message || "注册失败",
        });
      } else {
        setErrors({ submit: "无法连接至服务器" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    navigate("/login");
  };

  const showRegisterCode = role === "admin";
  const registerCodePlaceholder = "请输入管理员注册码";

  return (
    <div className={style["register-container"]}>
      <div className={style["register-wrapper"]}>
        <div className={style["register-header"]}>
          <p className={style["register-title"]}>请选择您要注册的账号类型</p>
        </div>

        <div className={style["role-tabs"]}>
          <button
            type="button"
            className={`${style["tab-btn"]} ${role === "regular" ? style.active : ""}`}
            onClick={() => handleRoleChange("regular")}
          >
            普通用户
          </button>
          <button
            type="button"
            className={`${style["tab-btn"]} ${role === "admin" ? style.active : ""}`}
            onClick={() => handleRoleChange("admin")}
          >
            管理员
          </button>
        </div>

        <form className={style["register-form"]} onSubmit={handleSubmit}>
          <div className={style["form-group"]}>
            <label htmlFor="username" className={style["form-label"]}>
              用户名
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleFormChange}
              className={`${style["form-input"]} ${errors.username ? style.error : ""}`}
              placeholder="请输入用户名"
            />
            {errors.username && (
              <span className={style["error-message"]}>{errors.username}</span>
            )}
          </div>

          <div className={style["form-group"]}>
            <label htmlFor="password" className={style["form-label"]}>
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleFormChange}
              className={`${style["form-input"]} ${errors.password ? style.error : ""}`}
              placeholder="请输入至少 6 位密码"
            />
            {errors.password && (
              <span className={style["error-message"]}>{errors.password}</span>
            )}
          </div>

          <div className={style["form-group"]}>
            <label htmlFor="email" className={style["form-label"]}>
              邮箱
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              className={`${style["form-input"]} ${errors.email ? style.error : ""}`}
              placeholder="请输入邮箱"
            />
            {errors.email && (
              <span className={style["error-message"]}>{errors.email}</span>
            )}
          </div>

          <div className={style["form-group"]}>
            <label htmlFor="verificationCode" className={style["form-label"]}>
              邮箱验证码
            </label>
            <div className={style["verification-code-container"]}>
              <input
                type="text"
                id="verificationCode"
                name="verificationCode"
                value={formData.verificationCode}
                onChange={handleFormChange}
                className={`${style["form-input"]} ${style["verification-code-input"]} ${
                  errors.verificationCode ? style.error : ""
                }`}
                placeholder="请输入6位验证码"
                maxLength={6}
              />
              <button
                type="button"
                className={`${style["send-code-btn"]} ${
                  countdown > 0 ? style.disabled : ""
                }`}
                onClick={handleSendVerificationCode}
                disabled={isSendingCode || countdown > 0 || !formData.email}
              >
                {isSendingCode
                  ? "发送中..."
                  : countdown > 0
                    ? `${countdown}秒后重试`
                    : codeSent
                      ? "重新发送"
                      : "发送验证码"}
              </button>
            </div>
            {errors.verificationCode && (
              <span className={style["error-message"]}>
                {errors.verificationCode}
              </span>
            )}
          </div>

          {showRegisterCode && (
            <div className={style["form-group"]}>
              <label htmlFor="registerCode" className={style["form-label"]}>
                注册码
              </label>
              <input
                type="text"
                name="registerCode"
                id="registerCode"
                value={formData.registerCode}
                onChange={handleFormChange}
                placeholder={registerCodePlaceholder}
                className={`${style["form-input"]} ${errors.registerCode ? style.error : ""}`}
              />
              {errors.registerCode && (
                <span className={style["error-message"]}>
                  {errors.registerCode}
                </span>
              )}
            </div>
          )}

          {errors.submit && (
            <div className={style["submit-error"]}>{errors.submit}</div>
          )}

          <button
            type="submit"
            className={style["register-button"]}
            disabled={isLoading}
          >
            {isLoading ? "注册中..." : `作为${roleLabelMap[role]}注册`}
          </button>
        </form>

        <div className={style["divider"]}>
          <span>或</span>
        </div>

        <div className={style["alternative-login"]}>
          <p className={style["link"]}>
            已有账户？
            <button
              type="button"
              className={style["login-button"]}
              onClick={handleLoginRedirect}
            >
              立即登录
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
