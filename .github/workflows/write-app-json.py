import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


APPS_JSON_URL = (
    "https://raw.githubusercontent.com/neurodesk/neurocommand/refs/heads/main/neurodesk/apps.json"
)
ZENODO_DEPOSITIONS_URL = "https://zenodo.org/api/deposit/depositions"
CONNECT_TIMEOUT_SECONDS = 5
READ_TIMEOUT_SECONDS = 30


def build_session() -> requests.Session:
    """
    Build a retrying HTTP session for transient network/server failures.
    """
    retry = Retry(
        total=6,
        connect=6,
        read=6,
        backoff_factor=1.0,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def fetch_apps_menu_entries(session: requests.Session) -> Dict:
    """
    Fetch neurocommand/apps.json once and reuse it.
    """
    try:
        response = session.get(
            APPS_JSON_URL,
            timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise Exception(f"Failed to fetch apps: {exc}") from exc

    try:
        return response.json()
    except ValueError as exc:
        raise Exception("Failed to decode apps.json response as JSON.") from exc


def get_deposition_license(deposition: Dict) -> str:
    """
    Extract the license identifier from a Zenodo deposition.
    Args:
        deposition (dict): A single Zenodo deposition object
    Returns:
        str: License identifier (e.g. "apache2.0", "mit") or empty string
    """
    metadata = deposition.get("metadata", {})
    license_info = metadata.get("license")
    if isinstance(license_info, dict):
        return license_info.get("id", "")
    if isinstance(license_info, str):
        return license_info
    return ""


def get_app_categories(menu_entries: Dict, app: str) -> List[str]:
    """
    Get the categories of the app
    Args:
        menu_entries (dict): App menu entries loaded from apps.json
        app (str): Application name
    Returns:
        list: List of categories
    """
    for key, value in menu_entries.items():
        if app in key:
            return menu_entries[key].get("categories", [])
        for sub_key in value.get("apps", {}).keys():
            if app in sub_key:
                return menu_entries[key].get("categories", [])
    print(f"Categories not found for {app}", flush=True)
    return []


def get_apps(menu_entries: Dict) -> List[str]:
    """
    Get all app image-version identifiers from apps.json
    Args:
        menu_entries (dict): App menu entries loaded from apps.json
    Returns:
        list: List of app identifiers
    """
    app_list = []
    for menu_data in menu_entries.values():
        for app_name, app_data in menu_data.get("apps", {}).items():
            if app_data.get("exec") == "":
                image_name_version = (
                    app_name.split(" ")[0]
                    + "_"
                    + app_name.split(" ")[-1]
                    + "_"
                    + app_data.get("version")
                )
                app_list.append(image_name_version)
    return app_list


def fetch_depositions(zenodo_token: str, session: requests.Session) -> List[Dict]:
    """
    Fetch published Zenodo depositions with pagination.
    """
    all_depositions = []
    page_size = 100
    page = 1

    while True:
        print(f"Fetching page {page} of packages from Zenodo", flush=True)
        params = {
            "access_token": zenodo_token,
            "status": "published",
            "page": page,
            "size": page_size,
        }

        try:
            response = session.get(
                ZENODO_DEPOSITIONS_URL,
                params=params,
                timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS),
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise Exception(
                f"Failed to fetch DOIs on page {page}: {exc}"
            ) from exc

        try:
            depositions = response.json()
        except ValueError as exc:
            raise Exception(
                f"Failed to decode Zenodo response JSON on page {page}."
            ) from exc

        if not isinstance(depositions, list):
            raise Exception(
                f"Unexpected Zenodo response on page {page}: expected a list."
            )

        all_depositions.extend(depositions)
        if len(depositions) < page_size:
            break
        page += 1

    return all_depositions


def write_to_file(zenodo_token, filename):
    """
    Write the list of DOIs from Zenodo to applist.json
    Args:
        zenodo_token (str): Zenodo token
        filename (str): Filename to write to
    """
    session = build_session()
    all_depositions = fetch_depositions(zenodo_token, session)
    menu_entries = fetch_apps_menu_entries(session)
    app_list = get_apps(menu_entries)
    print(f"Found {len(app_list)} apps in neurocommand/apps.json", flush=True)

    # Write application, categories, doi, and doi_url to applist.json file
    val = []
    for app in app_list:

        categories = get_app_categories(menu_entries, app.split("_")[0])

        found_doi = False
        for deposition in all_depositions:
            if (
                "title" not in deposition
                or "doi" not in deposition
                or "doi_url" not in deposition
            ):
                print(
                    f"Skipping deposition missing DOI fields: {deposition.get('title', '<unknown>')}",
                    flush=True,
                )
                continue
            if app in deposition["title"]:
                print(f"Processing DOI: {deposition['title']}", flush=True)
                doi = deposition["doi"]
                doi_url = deposition["doi_url"]
                license_id = get_deposition_license(deposition)
                entry = {"application": app, "categories": categories, "doi": doi, "doi_url": doi_url}
                if license_id:
                    entry["license"] = license_id
                val.append(entry)
                found_doi = True
                break
        if not found_doi:
            val.append({"application": app, "categories": categories})
    print(f"Writing {len(val)} entries to {filename}", flush=True)
    my_dict = {"list": val}
    with open(filename, "w") as fp:
        json.dump(my_dict, fp, sort_keys=True, indent=4)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        prog="Get Published DOIs from Zenodo",
    )

    parser.add_argument("--zenodo_token", type=str, required=True, help="Zenodo token")
    parser.add_argument(
        "--fail-on-error",
        action="store_true",
        help="Fail with non-zero exit code if any network/API error occurs.",
    )
    args = parser.parse_args()

    filename = Path(__file__).parent.parent.parent / "public" / "data" / "applist.json"
    print(f"Writing to {filename}", flush=True)

    try:
        write_to_file(args.zenodo_token, filename)
    except Exception as exc:
        if args.fail_on_error:
            raise
        print(
            "Warning: failed to refresh applist from Zenodo. "
            "Keeping existing applist.json and continuing.",
            flush=True,
        )
        print(f"Details: {exc}", flush=True)
        sys.exit(0)
