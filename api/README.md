# 吐槽区与匿名使用统计

## 数据边界

只保存：
- 随机生成的匿名 visitor/session ID；
- 访问、入口选择、下一步、结果页、吐槽提交等事件；
- 使用的功能名称；
- 吐槽文本。

不保存出生年月、缴费年限、缴费基数、个人账户余额、养老金测算金额等表单内容。

## 宝塔部署

1. 在宝塔新建 MySQL 数据库，例如 `yanglao`，创建独立数据库用户。
2. 在数据库中执行 `api/schema.sql`。
3. 把 `api/config.example.php` 复制到站点根目录的上一级：`/www/wwwroot/.yanglao-db.php`，填入真实数据库账号密码。
4. 确认站点启用了 PHP，并安装 `pdo_mysql` 扩展。
5. 部署时把 `api/` 目录一并复制到站点；真实密码文件不要复制进 Git 仓库。

## 快速分析 SQL

近30天匿名使用人数：

```sql
SELECT COUNT(DISTINCT visitor_id) AS visitors
FROM usage_event
WHERE created_at >= NOW() - INTERVAL 30 DAY;
```

近30天各功能入口：

```sql
SELECT feature, COUNT(*) AS uses
FROM usage_event
WHERE event_name = 'intent_click'
  AND created_at >= NOW() - INTERVAL 30 DAY
GROUP BY feature
ORDER BY uses DESC;
```

简单漏斗：

```sql
SELECT event_name, COUNT(DISTINCT session_id) AS sessions
FROM usage_event
WHERE created_at >= NOW() - INTERVAL 30 DAY
  AND event_name IN ('page_view','intent_click','wizard_next','result_view')
GROUP BY event_name;
```

最近吐槽：

```sql
SELECT id, content, created_at
FROM feedback
WHERE status = 'visible'
ORDER BY id DESC
LIMIT 50;
```

隐藏无效吐槽：

```sql
UPDATE feedback SET status = 'hidden' WHERE id = 123;
```
