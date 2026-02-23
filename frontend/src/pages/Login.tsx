import { useState } from "react";
import type { ChangeEvent, SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import style from "../css/Login.module.css";
import axios, { AxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import api from "../api/axios";

interface FormData {
  username: string;
  password: string;
}

interface Errors {
  username?: string;
  password?: string;
  submit?: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  user_id?: string;
  user_name?: string;
  role?: string;
}

function Login() {
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
  }); //表单数据
  const [errors, setErrors] = useState<Errors>({}); //登录错误
  const [isLoading, setIsLoading] = useState<boolean>(false); //加载状态
  const navigate = useNavigate(); //导航跳转
  const { login } = useAuth();

  // 处理表单数据改变
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
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

    return newErrors;
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 清除之前的submit错误
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: undefined }));
    }

    // 输入验证
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    // API调用
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await api.post<LoginResponse>("/login", {
        username: formData.username,
        password: formData.password,
      });

      if (response.data.success) {
        // 登录成功后的处理
        login(
          response.data.user_id ?? "", //空时默认为空
          formData.username,
          response.data.role ?? "",
        );
        alert(`欢迎回来，${response.data.user_name}!`);
        navigate("/");
      } else {
        alert("登录失败！");
        setErrors({ submit: response.data.message || "登录失败" });
      }
    } catch (error) {
      console.error("登录失败:", error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<LoginResponse>;
        // 服务器返回了错误状态码
        setErrors({
          submit: axiosError.response?.data?.message || "登录失败",
        });
      } else {
        // 未连接
        setErrors({ submit: "无法连接至服务器" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // const handleForgotPassword = () => {
  //   alert("待制作中");
  // };

  const handleRegisterRedirect = () => {
    // 跳转到注册页面
    navigate("/register");
  };

  return (
    <div className={style[`login-container`]}>
      <div className={style["login-wrapper"]}>
        <div className={style["login-header"]}>
          <h1 className={style["login-title"]}>欢迎回来</h1>
          <p className={style["login-subtitle"]}>请登录您的账户</p>
        </div>

        <form className={style["login-form"]} onSubmit={handleSubmit}>
          <div className={style["form-group"]}>
            <label htmlFor="username" className={style["form-label"]}>
              用户名
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`${style["form-input"]} ${errors.username ? style.error : ""}`}
              placeholder="请输入用户名"
              autoComplete="username"
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
              onChange={handleChange}
              className={`${style["form-input"]} ${errors.password ? style.error : ""}`}
              placeholder="请输入密码"
            />
            {errors.password && (
              <span className={style["error-message"]}>{errors.password}</span>
            )}
          </div>

          {/* <div className={style["form-options"]}>
            <button
              type="button"
              className={style["forgot-password"]}
              onClick={handleForgotPassword}
            >
              忘记密码？
            </button>
          </div> */}

          {errors.submit && (
            <div className={style["submit-error"]}>{errors.submit}</div>
          )}

          <button
            type="submit"
            className={style["login-button"]}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={style["loading-spinner"]}>
                <span className={style["spinner"]}></span>
                登录中...
              </span>
            ) : (
              "登录"
            )}
          </button>
        </form>

        <div className={style["divider"]}>
          <span>或</span>
        </div>

        <div className={style["alternative-login"]}>
          <p className={style["register-link"]}>
            还没有账户？{" "}
            <button
              type="button"
              className={style["register-button"]}
              onClick={handleRegisterRedirect}
            >
              立即注册
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
