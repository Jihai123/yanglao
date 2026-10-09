# 获客 P1 · 最终代码评审与数据库验收 Gate（2026-10-08）

## 项目状态
PR #21 只在 `growth/acquisition-p1-landings` 工作分支，**生产未更新，main 未合并**。

### 设计审查结论
- 独立三个可抓取 HTML 页面、唯一 canonical、title/H1、更新日期、政策出处、内链、sitemap；复用首页 `data-intent` 启动现有年龄/退休规划能力，没有复制计算公式。
- 新事件 `landing_cta_click` 和 `landing_flow_start` 仅传固定 slug/feature/step，复用匿名 session、flow、source；不采集出生年月、养老金输入、会话身份信息。前端通过 SessionStorage 保留跨页来源，首页桥接复用原流转。
- Admin 专题统计独立于当前/legacy/all 展示范围，固定为 `DIAGNOSTICS_APP_VERSION`，按近30天计数，页面访问和 CTA 按 session 去重、测算结果按 flow 去重；搜索曝光必须另从站长平台获取。
- Admin 查询隔离在 `api/acquisition-query.php`，异常时仅报告 `unavailable`，不改变登录结果与原有全站统计；没有 DB 结构修改或迁移。
- 生产入口仍保留原 V2.6.4，新增内容在独立分支；未触碰任何已有计算公式。

### 测试
- GitHub Actions 已完成的一个完整浏览器批次：**90 / 90 PASS**。
- 代码测试包括 Node、PHP 语法、入口跳转与跨页 Flow ID、历史主链回归。
- 专门新增隔离 MySQL 8 `acquisition-mysql` job：连接实际 MySQL 8，使用项目 `api/schema.sql` 创建临时 CI 表；PDO `ATTR_EMULATE_PREPARES=false` 运行原查询；通过重复访问、重复 CTA、重复结果、历史版本噪声、未完成流程和零数据页面的断言。成功标记 `MYSQL_ACQUISITION_QUERY_PASS`。
- **MySQL 集成 CI 与真实生产库不是一回事**。生产库可能是 MariaDB 或不同版本、且有历史迁移差异；现有生产只读核验仍是上线前最后一道 Gate。新增 `scripts/audit-acquisition-readonly.php`，可配合锁定 commit 的查询模块在独立临时目录运行，只执行 SELECT、检查原始数据表字段，不写数据、不修改生产代码。

### 上线前仍需取得的证据（保持 HOLD）
1. 运行指定 commit 的生产只读脚本，获得 `PRODUCTION_ACQUISITION_READONLY_PASS`。
2. 确认 admin.php 既有 `action=v262&scope=current/legacy` 返回的原始 payload 不受影响（生产服务器可在部署后做接口验收）；新字段 `acquisition` 即便查询错误也不能让后台崩溃。
3. 完成最新 PR HEAD 的三条 CI Gate（test-v2、browser-smoke、acquisition-mysql）。
4. 对外发布只在明确授权后合并与部署，部署后再提交三个新增 URL 到各站长平台并观察实测获客。

## Bing 归零的代码取证（截至 2026-10-08）

### 已确定时间线
- 2026-09-13 16:06（北京时）：`5d04fe2` Merge PR #9（V2.6 转化版）。
- 2026-09-14 21:27（北京时）：`4a17ab3` Merge PR #10，主要是分析和统计修复。
- 2026-09-14 22:59（北京时）：`fdfc9b7` Merge PR #11，后台统计审计。
- 2026-09-15 16:38（北京时）：`38a2690` Merge PR #15，管理后台接口整合。
- 2026-09-15 21:32（北京时）：`5e3ced8` Merge PR #16，精准测算体验升级。
- `2026-09-16T00:00` 到 `2026-09-18T23:59 UTC` 的 GitHub 仓库历史中没有新提交记录（提交时间并不等于生产部署时间；需依据服务器部署日志判断是否实际更新）。
- Bing Webmaster 3M Search Performance 的公开查询词和页面截图显示：此前 首页独占 **1.6K impressions / 37 clicks，平均位置8.28**，自 **9/16 前后**起曲线接近零。

### 实际源码差异
对比 `05c964e`（9/06 main）与 `5d04fe2`（9/13）：
- 首页 H1 `什么时候退休，能领多少？` → `先知道答案，再慢慢算准`，首屏 eyebrow `退休年龄 · 缴费年限 · 养老金` → `退休规划助手`。
- 首页几个明确入口改成以 `30 秒快速测算`为主的转化入口。原来的“我已经离职 / 灵活就业”独立入口不再位于首页主任务列表。这些变化可能削弱部分泛“养老金计算器”等关键词与首屏的直接语义对应，但不等于自动降权。
- `title`、`meta description`、`robots=index,follow`、`canonical=https://yanglao.zhibeimao.com/` **保持不变**；9/12～9/15 没有 `robots.txt` 或 `sitemap.xml` 提交。
- 9/14～9/15 的主要改动集中在后台 API、analytics、表单体验，没有看到变更上述四项 SEO 信号的证据。
- 部分前端代码文件更新后，其首页引入的带版本号缓存键并未一同调整；这是历史部署缓存一致性风险点，但没有 Bing 因它而失去排名的证据。
- Bing URL Inspection 检查 `Indexed successfully`、抓取成功、`Live URL can be indexed`，且 `View Indexed page` 确认存的是新版 V2.6.4 HTML。Bing 公共 `url:` 搜索也能找到首页。因此 **不是“完全移出索引 / 旧索引首页”**。

### 技术判断
- **有时间吻合且可验证的代码线索**：9/13 首页 H1/首屏语义弱化、入口重构，与核心关键词平均第7～10名的历史表现可能有关。
- **尚未建立因果关系**：突然所有曝光归零也可能来自 Bing search-serving、搜索系统或报表维度变化；单纯改 H1 不足以解释完整断崖。不能宣称某一次提交一定触发处罚。
- **建议后续审慎实验**：先保留 PR #21 3 个独立主题页、不要大幅重写首页。若需验证首页语义因素，在另一个独立 SEO 分支用有明确关键词的 H1/首屏文案做一次小范围改动，同时保留转化入口；提前固定观察窗口，以 Bing 的 impressions、queries、ranking 对照（至少 7～14 天）评估。不能为了试验伪造站长数据。

## 2026-10-09 最终 Gate 补充：生产只读 SQL 实测已通过

2026-10-09 网站维护者按本 PR 指定版本提供了生产服务器一次性只读脚本的实际输出；不是 CI 假数据：

```text
flexible-employment-pension: visits=0, cta_sessions=0, started_flows=0, result_flows=0
minimum-pension-years: visits=0, cta_sessions=0, started_flows=0, result_flows=0
retirement-age: visits=0, cta_sessions=0, started_flows=0, result_flows=0
PRODUCTION_ACQUISITION_READONLY_PASS: existing schema and actual query compatible; no data changed
```

结论：**生产实际 `usage_event` 字段存在、SQL 可在现有数据库执行、返回三行合法计数，生产 DB 兼容 Gate PASS**。三个页面尚未上线，计数 0 符合预期，不应误认为未接入数据库。该核验只执行只读查询及连接会话范围的时区设置，未执行业务写入/迁移/部署/重启。生产历史总量、慢查询在数据增长后的性能及非自测筛选仍不属于本次 SQL 兼容 Gate 的已验证范围。

CLI 同时打印 `PHP Startup: exif` 加载警告：扩展 module API 20230831 与解释器 API 20210902 不匹配。这是 CLI PHP 扩展配置的独立运维问题，与本次 PDO/MySQL 查询结果无关；不在获客 PR 中直接修改生产 PHP 配置。

### 代码修复及完整回归

- `74d109f`：结果归因须同时满足 flow_id 与 session_id；空 session 不计；MySQL 合成数据增加跨会话/旧版本/空值/合法结果断言；修复两处政策依据 URL。已独立查证政府官方网站的《渐进式延迟法定退休年龄的决定》和最低缴费年限附表。
- `87eb0e4`：生产只读核验兼容站点根目录外 `.yanglao-db.php` 配置。
- `f057e86`：浏览器测试校验 CTA 事件 POST 及跨页同一匿名会话、有效 flow_id。
- `838ff19`：只读核验脚本增加 PHP lint。
- GitHub Actions [#37878237718](https://github.com/Jihai123/yanglao/actions/runs/37878237718) (HEAD `838ff19ec0004615eacc9adf94d1ba3d78d2f088`)：`test-v2`、`acquisition-mysql`、`browser-smoke` **全 SUCCESS**；Node **92/92**、真实 MySQL 8 PDO 测试 **PASS**、Chromium **90/90**、PHP/JS syntax **PASS**。

**最终合并判断：代码/CI/浏览器/生产实际 SQL 兼容 Gate 全 PASS，可按既定审批合并 `main`；生产部署仍单独授权、独立验收。**

**持续经营限制**：后台页面会话数不是“可归因非自测访问”完成指标的自动证明。仍需在上线后结合日志、站长平台数据、来源和测试者识别制定 30 天去自测口径；不得将普通访客数伪称搜索曝光或真实新增用户。Bing 9/16 异常仍未归因，单独存放在 PR #20 分支报告。
