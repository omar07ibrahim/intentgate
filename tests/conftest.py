from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from intentgate.engine import run_scenario
from intentgate.model import Scenario, parse_scenario

ROOT = Path(__file__).resolve().parents[1]
SCENARIO_PATH = ROOT / "scenarios" / "hr-assistant.json"


@pytest.fixture(scope="session")
def scenario_data() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(SCENARIO_PATH.read_text(encoding="utf-8")))


@pytest.fixture(scope="session")
def scenario(scenario_data: dict[str, Any]) -> Scenario:
    return parse_scenario(scenario_data)


@pytest.fixture(scope="session")
def artifact(scenario: Scenario) -> dict[str, Any]:
    return run_scenario(scenario)
