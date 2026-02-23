import { useState } from "react";
import type { ChangeEvent, SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import style from "../css/Register.module.css";
import api from "../api/axios"
import axios from "axios";

type Role = "regular" | "enterprise";
interface FormData {
  username: string;
  password: string;
  email: string;
  registerCode: string;//企业用户使用提供的注册码直接认证企业身份
}

interface Errors extends Partial<FormData> {
  submit?: string;
}

interface RegisterResponse {
  success: boolean;
  message?: string;
}

function Register() {
  //选择的注册角色类型
  const [role, setRole] = useState<Role>("regular");
  //表单数据
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    email: "",
    registerCode: "",
  });
  //注册错误
  const [errors, setErrors] = useState<Errors>({});
  //加载状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  //导航跳转
  const navigate = useNavigate();

  // 切换注册类型时重置错误和部分数据
  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setErrors({});
    setFormData((prev) => ({ ...prev, registerCode: "" }));
  };
  // 处理表单数据改变
  const handleFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 清除对应字段的错误
    if (errors[name as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // 规范数据形式，若有误则返回对应的错误
  const validateForm = (): Errors => {
    const newErrors: Errors = {};

    if (!formData.username.trim()) {
      newErrors.username = "请输入用户名";
    }

    if (!formData.password) {
      newErrors.password = "请输入密码";
    } else if (formData.password.length < 6) {
      newErrors.password = "密码长度至少6位";
    }

    //邮箱格式验证可由input type属性实现
    if (!formData.email) {
      newErrors.email = "请输入邮箱";
    }

    // 如果是管理员，必须填写验证码
    if (role === "enterprise" && !formData.registerCode.trim()) {
      newErrors.registerCode = "请输入管理员专用注册码";
    }
    return newErrors;
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // 输入验证
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    // API调用
    try {
      const response = await api.post<RegisterResponse>("/register", {
        ...formData,
        role: role,
      });

      if (response.data.success) {
        alert(`${role === "enterprise" ? "企业账号" : "用户"}注册成功，请重新登录`);
        navigate("/login");
      } else {
        setErrors({ submit: response.data.message || "注册失败" });
      }
    } catch (error) {
      console.error("注册失败:", error);
      if (axios.isAxiosError(error)) {
        // 服务器返回了错误状态码
        setErrors({
          submit: error.response?.data?.message || "注册失败",
        });
      } else {
        // 未连接
        setErrors({ submit: "无法连接至服务器" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    // 可以跳转到登录页面
    navigate("/login");
  };

  return (
    <div className={style[`register-container`]}>
      <div className={style["register-wrapper"]}>
        <div className={style["register-header"]}>
          <p className={style["register-title"]}>请选择您要注册的账号类型</p>
        </div>

        {/* 角色切换 Tab */}
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
            className={`${style["tab-btn"]} ${role === "enterprise" ? style.active : ""}`}
            onClick={() => handleRoleChange("enterprise")}
          >
            企业用户
          </button>
        </div>

        {/* 注册用户名输入项 */}
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

          {/* 注册密码输入项 */}
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
              placeholder="请输入至少6位密码"
            />
            {errors.password && (
              <span className={style["error-message"]}>{errors.password}</span>
            )}
          </div>

          {/* 注册邮箱输入项 */}
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
            {errors.password && (
              <span className={style["error-message"]}>{errors.email}</span>
            )}
          </div>

          {/* 管理员额外字段：动态渲染 */}
          {role === "enterprise" && (
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
                placeholder="请输入由系统发放的注册码"
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
            {isLoading
              ? "注册中..."
              : `作为${role === "enterprise" ? "企业账号" : "普通用户"}注册`}
          </button>
        </form>

        <div className={style["divider"]}>
          <span>或</span>
        </div>

        <div className={style["alternative-login"]}>
          <p className={style["link"]}>
            已有账户？{" "}
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
