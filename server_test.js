const express = require('express');
const app = express();

// 1. 解析 JSON
app.use(express.json());

// 2. 静态资源
app.use(express.static('public'));

// 3. GET 接口
app.get('/foods', (req, res) => {
  res.json(['apple', 'banana']);
});

// 4. POST 接口
app.post('/foods', (req, res) => {
  const food = req.body;
  res.json({
    message: '添加成功',
    data: food
  });
});

// 5. 启动
app.listen(3001, () => {
  console.log('server running...');
});