from pathlib import Path

import pytest


@pytest.fixture
def app_url() -> str:
    html_file = Path(__file__).resolve().parents[1] / "pension_calculator_v7.html"
    return html_file.as_uri()


@pytest.fixture
def app_page(page, app_url):
    page.goto(app_url)
    return page
