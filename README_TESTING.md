# 测试体系说明（养老金计算器）

本项目提供两层测试：

- **逻辑回归测试（tests_logic）**：纯 Python，对核心算法做确定性断言。
- **浏览器 E2E 测试（tests_e2e）**：基于 `pytest-playwright`，模拟真实用户操作页面。

## 1. 安装依赖

```bash
pip install -r requirements-test.txt
```

## 2. 安装 Playwright 浏览器

```bash
playwright install
```

> 如需仅安装 Chromium，可使用：`playwright install chromium`

## 3. 运行测试

### 一键运行（推荐）

Linux/macOS:

```bash
./run_tests.sh
```

Windows:

```bat
run_tests.bat
```

### 只跑逻辑测试

```bash
pytest tests_logic -q
# 如果希望命令行逐条显示测试数据，可改用
pytest tests_logic -vv
```

或：

```bash
./run_tests.sh logic
```

### 只跑 E2E 测试

```bash
pytest tests_e2e -q
```

或：

```bash
./run_tests.sh e2e
```

### 全量测试

```bash
pytest -q
```

## 4. 报告与失败产物

`pytest.ini` 已默认开启以下能力：

- HTML 报告：`test-artifacts/reports/pytest-report.html`
- 逻辑测试详细案例报告：`test-artifacts/reports/logic-case-results.md`
- 逻辑测试详细 JSON：`test-artifacts/reports/logic-case-results.json`
- E2E 失败截图：Playwright `--screenshot=only-on-failure`
- E2E 失败 trace：Playwright `--tracing=retain-on-failure`
- E2E 失败视频：Playwright `--video=retain-on-failure`

Playwright 产物输出目录：

- `test-artifacts/traces/`（包含失败截图、trace、视频）

你也可以按需打开 HTML 报告：

- macOS: `open test-artifacts/reports/pytest-report.html`
- Linux: `xdg-open test-artifacts/reports/pytest-report.html`
- Windows: 双击文件或 `start test-artifacts\reports\pytest-report.html`

## 5. 调试建议

- Headless（CI/默认）：
  ```bash
  pytest tests_e2e -q
  ```
- Headed（本地调试）：
  ```bash
  pytest tests_e2e -q --headed --slowmo 200
  ```

## 6. 目录结构

```text
tests_logic/
  pension_logic.py
  test_pension_logic.py

tests_e2e/
  conftest.py
  test_retirement_quick.py
  test_employee_pension.py
  test_resident_pension.py

test-artifacts/
  reports/
  traces/
  screenshots/
```

> 说明：`test-artifacts/screenshots/` 为预留目录；Playwright 默认统一输出在 `test-artifacts/traces/`。
