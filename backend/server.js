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

// // 执行查询并获取结果
// const fetchData = async () => {
//   const client = await pool.connect();
//   try {
//     const res = await client.query("SELECT * FROM user_info");
//     console.log("查询结果：", res.rows); // 打印查询结果
//   } catch (err) {
//     console.error(err);
//   } finally {
//     client.release(); // 释放客户端连接
//   }
// };

// //插入数据
// const insertData = async () => {
//   const client = await pool.connect();
//   const insertQuery =
//     "INSERT INTO user_info (user_name, password) VALUES($1, $2) RETURNING *";
//   const values = ["hhy1", "123456"];

//   try {
//     const res = await client.query(insertQuery, values);
//     console.log("插入成功:", res.rows[0]);
//   } catch (err) {
//     console.error(err);
//   } finally {
//     client.release();
//   }
// };

// // 删除数据
// const deleteData = async () => {
//   const client = await pool.connect();
//   const deleteQuery = "DELETE FROM user_info";

//   try {
//     const res = await client.query(deleteQuery);
//     console.log("删除成功：", res);
//   } catch (err) {
//     console.error(err);
//   } finally {
//     client.release();
//   }
// };

// deleteData();

// insertData();

// fetchData();

const app = express();
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体

// 注册接口
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 检查用户是否已存在
    const userExists = await pool.query(
      "SELECT * FROM user_info WHERE user_name = $1",
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "用户名已存在"
      });
    }

    //密码加密（待实现）
    
    // 插入新用户
    const result = await pool.query(
      "INSERT INTO user_info (user_name, password) VALUES ($1, $2) RETURNING user_id, user_name",
      [username, password]
    );

    res.status(201).json({
      success: true,
      message: "注册成功",
      user: {
        id: result.rows[0].user_id,
        name: result.rows[0].user_name
      }
    });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误"
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
