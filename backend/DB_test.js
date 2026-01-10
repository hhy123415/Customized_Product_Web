const { Pool } = require("pg");

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

//插入数据
const insertData = async () => {
  const client = await pool.connect();
  const insertQuery =
    "INSERT INTO product_info (picture_path, product_name, description, is_display) VALUES($1, $2, $3, $4) RETURNING *";
  const values = ["2.jpg","划船桨", "请添加简介",true];

  try {
    const res = await client.query(insertQuery, values);
    console.log("插入成功:", res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
};

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

insertData();

// fetchData();

