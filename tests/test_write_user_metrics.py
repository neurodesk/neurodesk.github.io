from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / ".github"
    / "workflows"
    / "write-user-metrics.py"
)
SPEC = importlib.util.spec_from_file_location("write_user_metrics", SCRIPT_PATH)
assert SPEC and SPEC.loader
write_user_metrics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(write_user_metrics)


class BuildMetricsTests(unittest.TestCase):
    def test_default_output_targets_astro_public_directory(self) -> None:
        with mock.patch("sys.argv", ["write-user-metrics.py"]):
            args = write_user_metrics.parse_args()

        self.assertEqual(args.output, "public/data/user-metrics.json")

    def test_summarize_tracking_start_uses_first_reported_date(self) -> None:
        rows = [
            {"dimensionValues": [{"value": "20260714"}]},
            {"dimensionValues": [{"value": "20260715"}]},
        ]

        self.assertEqual(
            write_user_metrics.summarize_tracking_start(rows),
            "2026-07-14",
        )

    def test_summarize_tracking_start_returns_none_for_empty_rows(self) -> None:
        self.assertIsNone(write_user_metrics.summarize_tracking_start([]))

    def test_users_to_date_uses_all_time_total_users(self) -> None:
        def fake_run_report(
            token: str,
            property_id: str,
            body: dict,
            start_date: str = write_user_metrics.EARLIEST_START_DATE,
            end_date: str = "today",
        ) -> list[dict]:
            del token, property_id, end_date
            metric_names = [metric["name"] for metric in body.get("metrics", [])]
            dimension_names = [
                dimension["name"] for dimension in body.get("dimensions", [])
            ]

            if metric_names == ["newUsers"] and dimension_names == ["yearMonth"]:
                return [
                    {
                        "dimensionValues": [{"value": "202607"}],
                        "metricValues": [{"value": "35"}],
                    }
                ]

            if metric_names == ["totalUsers"] and dimension_names == [
                "countryId",
                "country",
            ]:
                return []

            if metric_names == ["totalUsers"] and start_date == "30daysAgo":
                return [{"metricValues": [{"value": "60"}]}]

            if (
                metric_names == ["totalUsers"]
                and start_date == write_user_metrics.EARLIEST_START_DATE
            ):
                return [{"metricValues": [{"value": "75"}]}]

            if metric_names == ["totalUsers", "sessions", "screenPageViews"]:
                return [
                    {
                        "metricValues": [
                            {"value": "60"},
                            {"value": "103"},
                            {"value": "250"},
                        ]
                    }
                ]

            self.fail(
                f"Unexpected report: metrics={metric_names}, "
                f"dimensions={dimension_names}, start_date={start_date}"
            )

        with mock.patch.object(
            write_user_metrics, "run_report", side_effect=fake_run_report
        ):
            metrics = write_user_metrics.build_metrics("token", "property", 30)

        self.assertEqual(metrics["totalUsers"], 75)
        self.assertEqual(metrics["periodUsers"], 60)
        self.assertEqual(metrics["months"][0]["newUsers"], 35)
        self.assertEqual(metrics["months"][0]["cumulativeUsers"], 35)

    def test_main_keeps_segment_when_tracking_start_lookup_fails(self) -> None:
        aggregate_metrics = {
            "totalUsers": 75,
            "periodUsers": 60,
            "periodSessions": 103,
            "periodPageViews": 250,
            "months": [],
            "countries": [],
        }
        segment_metrics = {
            "totalUsers": 20,
            "periodUsers": 10,
            "periodSessions": 15,
            "periodPageViews": 25,
            "months": [],
            "countries": [],
        }

        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "user-metrics.json"
            args = SimpleNamespace(
                property_id="property",
                output=str(output),
                period_days=30,
                allow_missing_token=False,
            )
            with (
                mock.patch.dict(
                    os.environ,
                    {write_user_metrics.GA4_SERVICE_ACCOUNT_KEY_ENV: "{}"},
                ),
                mock.patch.object(write_user_metrics, "parse_args", return_value=args),
                mock.patch.object(
                    write_user_metrics,
                    "get_access_token",
                    return_value="token",
                ),
                mock.patch.object(write_user_metrics, "load_webapp_segments", return_value=[]),
                mock.patch.object(
                    write_user_metrics,
                    "GA4_SEGMENTS",
                    [write_user_metrics.GA4_SEGMENTS[0]],
                ),
                mock.patch.object(
                    write_user_metrics,
                    "build_metrics",
                    side_effect=[aggregate_metrics, segment_metrics],
                ),
                mock.patch.object(
                    write_user_metrics,
                    "tracking_start_report",
                    side_effect=write_user_metrics.requests.RequestException(
                        "temporary GA4 failure"
                    ),
                ),
            ):
                result = write_user_metrics.main()

            data = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(result, 0)
        self.assertEqual(data["totalUsers"], 75)
        self.assertEqual(len(data["segments"]), 1)
        self.assertIsNone(data["segments"][0]["trackingStartDate"])
        self.assertEqual(data["segments"][0]["totalUsers"], 20)


CATALOG = {"apps": [
    {"id": "spinalcordtoolbox", "path": "sct", "title": "Spinal Cord Toolbox", "users": 999},
    {"id": "deface", "path": "deface", "title": "Deface", "users": 999},
    {"id": "new-tool", "path": "new-tool", "title": "New tool", "users": 0},
]}


def matches(expression: dict, host: str, path: str) -> bool:
    if "orGroup" in expression:
        return any(matches(item, host, path) for item in expression["orGroup"]["expressions"])
    if "andGroup" in expression:
        return all(matches(item, host, path) for item in expression["andGroup"]["expressions"])
    rule = expression["filter"]
    value = {"hostName": host, "pagePath": path}[rule["fieldName"]]
    expected = rule["stringFilter"]["value"]
    if not rule["stringFilter"]["caseSensitive"]:
        value, expected = value.lower(), expected.lower()
    if rule["stringFilter"]["matchType"] == "EXACT":
        return value == expected
    assert rule["stringFilter"]["matchType"] == "BEGINS_WITH"
    return value.startswith(expected)


class WebappMetricsTests(unittest.TestCase):
    def load_catalog(self, catalog=CATALOG):
        with mock.patch.object(write_user_metrics.requests, "get") as get:
            get.return_value.json.return_value = catalog
            segments = write_user_metrics.load_webapp_segments()
        get.assert_called_once_with("https://webapps.neurodesk.org/analytics.json", timeout=60)
        return segments

    def test_catalog_includes_new_and_zero_usage_apps_with_canonical_ids(self):
        segments = self.load_catalog()
        self.assertEqual([s["id"] for s in segments], ["webapp-sct", "webapp-deface", "webapp-new-tool"])
        self.assertEqual(segments[0]["url"], "https://webapps.neurodesk.org/sct/")
        self.assertEqual(segments[0]["name"], "Spinal Cord Toolbox")

    def test_filter_matches_current_and_legacy_urls_without_neighbor_apps(self):
        for segment in self.load_catalog():
            slug = segment["id"].removeprefix("webapp-")
            expression = write_user_metrics.dimension_filter_for_segment(segment)
            for path in ["/" + slug, "/" + slug + "/", "/" + slug + "/results/index.html"]:
                self.assertTrue(matches(expression, "webapps.neurodesk.org", path))
                self.assertFalse(matches(expression, "unrelated.org", path))
            for path in ["/", "/" + slug + "-other/", "/other/" + slug]:
                self.assertFalse(matches(expression, "webapps.neurodesk.org", path))
            if slug == "sct":
                self.assertTrue(matches(expression, "sct.neurodesk.org", "/"))
                self.assertTrue(matches(expression, "sct.neurodesk.org", "/results"))
            self.assertEqual(write_user_metrics.public_segment_config(segment)["filters"], expression)

    def test_invalid_catalog_fails_instead_of_publishing_partial_list(self):
        for catalog in [{}, {"apps": []}, {"apps": [None]}, {"apps": [{"title": "Tool", "path": "../tool"}]},
                        {"apps": [{"title": "Tool", "path": "/tool"}]},
                        {"apps": [{"title": "", "path": "tool"}]},
                        {"apps": [CATALOG["apps"][0], CATALOG["apps"][0]]}]:
            with self.subTest(catalog=catalog), self.assertRaises(ValueError):
                self.load_catalog(catalog)

    def test_main_queries_all_catalog_apps_and_uses_ga4_totals(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "metrics.json"
            args = SimpleNamespace(property_id="123", output=str(output), period_days=30, allow_missing_token=False)
            def report(token, property_id, body, start_date=write_user_metrics.EARLIEST_START_DATE, end_date="today"):
                expression = body.get("dimensionFilter")
                empty = expression and matches(expression, "webapps.neurodesk.org", "/new-tool/")
                if body.get("dimensions") or empty:
                    return []
                return [{"metricValues": [{"value": "42"}, {"value": "51"}, {"value": "67"}]}]
            with (mock.patch.dict(os.environ, {write_user_metrics.GA4_SERVICE_ACCOUNT_KEY_ENV: "{}"}),
                  mock.patch.object(write_user_metrics, "parse_args", return_value=args),
                  mock.patch.object(write_user_metrics, "get_access_token", return_value="token"),
                  mock.patch.object(write_user_metrics.requests, "get") as get,
                  mock.patch.object(write_user_metrics, "run_report", side_effect=report)):
                get.return_value.json.return_value = CATALOG
                self.assertEqual(write_user_metrics.main(), 0)
            get.assert_called_once()
            data = json.loads(output.read_text())
        apps = [s for s in data["segments"] if s["id"].startswith("webapp-")]
        self.assertEqual([s["id"] for s in apps], ["webapp-sct", "webapp-deface", "webapp-new-tool"])
        self.assertEqual([s["totalUsers"] for s in apps], [42, 42, 0])
        self.assertEqual([s["periodUsers"] for s in apps], [42, 42, 0])

    def test_placeholder_does_not_fetch_catalog(self):
        args = SimpleNamespace(property_id="", output="unused", period_days=30, allow_missing_token=True)
        with (mock.patch.dict(os.environ, {write_user_metrics.GA4_SERVICE_ACCOUNT_KEY_ENV: ""}),
              mock.patch.object(write_user_metrics, "parse_args", return_value=args),
              mock.patch.object(write_user_metrics, "write_json"),
              mock.patch.object(write_user_metrics.requests, "get") as get):
            self.assertEqual(write_user_metrics.main(), 0)
        get.assert_not_called()

    def test_catalog_fetch_failure_does_not_overwrite_metrics(self):
        args = SimpleNamespace(property_id="123", output="unused", period_days=30, allow_missing_token=False)
        with (mock.patch.dict(os.environ, {write_user_metrics.GA4_SERVICE_ACCOUNT_KEY_ENV: "{}"}),
              mock.patch.object(write_user_metrics, "parse_args", return_value=args),
              mock.patch.object(write_user_metrics.requests, "get", side_effect=write_user_metrics.requests.RequestException("offline")),
              mock.patch.object(write_user_metrics, "write_json") as write):
            self.assertEqual(write_user_metrics.main(), 1)
        write.assert_not_called()


if __name__ == "__main__":
    unittest.main()
