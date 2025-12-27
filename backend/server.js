const express = require("express")
const { Pool } = require('pg');

//连接数据库
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'WebDB',
    password: '123456',
    port: 5432,
});

// //测试连接
// pool.connect()
//     .then(client => {
//         console.log('成功连接到数据库');
//         client.release(); // 释放客户端连接
//     })
//     .catch(err => console.error('连接失败', err));


const app = express()
app.use(express.json());

app.get("/", function(req, res) {
  res.send("It's working!")
})

app.listen(3001, () => {
  console.log("app listening on port 3001")
})
