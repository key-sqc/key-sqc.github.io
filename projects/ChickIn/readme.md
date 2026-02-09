# 本地打卡应用（带MongoDB同步）
基于Express+MongoDB+原生JS开发的本地打卡工具，仅在电脑启动后端后可同步数据，离线时纯本地存储。

## 本地启动步骤
1. 确保本地安装Node.js和MongoDB，且MongoDB已启动（执行mongod）
2. 克隆仓库后，进入项目目录，安装依赖：
   npm install express mongoose cors body-parser
3. 启动后端服务：
   node app.js
4. 直接双击打开index.html，即可使用所有功能（打卡/补签/同步）

## 注意事项
- 后端默认运行在http://192.168.0.52:3000，若本地IP不同，修改script.js中ENV.BASE_URL即可
- 仅本地使用，无需部署服务器，关闭后端后前端仍可本地打卡，联网启动后端后自动同步

