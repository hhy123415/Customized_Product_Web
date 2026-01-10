const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");

//连接数据库
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "WebDB",
  password: "123456",
  port: 5432,
});

// 测试连接
pool
  .connect()
  .then((client) => {
    console.log("成功连接到数据库");
    client.release();
  })
  .catch((err) => console.error("数据库连接失败:", err));

const app = express();
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体

// 注册接口
app.post("/api/register", async (req, res) => {
  const { username, password, email } = req.body;

  try {
    // 检查用户是否已存在
    const userExists = await pool.query(
      "SELECT * FROM user_info WHERE user_name = $1",
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "用户名已存在",
      });
    }

    //密码加密（待实现）

    // 插入新用户
    const result = await pool.query(
      "INSERT INTO user_info (user_name, password, user_email) VALUES ($1, $2,$3) RETURNING user_id, user_name",
      [username, password, email]
    );

    res.status(201).json({
      success: true,
      message: "注册成功",
      user: {
        id: result.rows[0].user_id,
        name: result.rows[0].user_name,
      },
    });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

// 登录接口
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 查询用户
    const result = await pool.query(
      "SELECT * FROM user_info WHERE user_name = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "用户名或密码错误",
      });
    }

    const user = result.rows[0];

    // 验证密码（实际项目中比较哈希值）
    // const validPassword = await bcrypt.compare(password, user.password);
    const validPassword = password === user.password; // 简化版本

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "用户名或密码错误",
      });
    }

    // 登录成功
    res.json({
      success: true,
      message: "登录成功",
      user: {
        id: user.user_id,
        name: user.user_name,
      },
    });
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

// 获取首页商品的数据
app.get("/api/nav-items-default", async (req, res) => {
  try {
    //查询图片路径、商品名称和简介
    const result = await pool.query(
      "SELECT * FROM product_info WHERE is_display = true"
    );

    res.json({
      success: true,
      message: "获取数据成功",
      result: result.rows,
    });
  } catch (error) {
    console.error("获取nav-items错误:", error);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "API服务器正在运行",
  });
});

app.listen(3001, () => {
  console.log("服务器运行在 http://localhost:3001");
});
