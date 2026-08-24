import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


APPS_JSON_URL = (
    "https://raw.githubusercontent.com/neurodesk/neurocommand/refs/heads/main/neurodesk/apps.json"
)
ZENODO_DEPOSITIONS_URL = "https://sandbox.zenodo.org/api/deposit/depositions"
README_BASE_URL = (
    "https://raw.githubusercontent.com/neurodesk/neurocontainers/main/recipes"
)
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


def fetch_app_descriptions(session: requests.Session, app_names: List[str]) -> Dict[str, str]:
    """
    Fetch the description for each unique app from neurocontainers.

    Tries ``recipes/{app}/README.md`` first.  If that returns 404, falls back
    to the ``readme`` field inside ``recipes/{app}/build.yaml``.

    Returns a dict mapping app name -> description string.
    """
    descriptions: Dict[str, str] = {}
    for name in app_names:
        readme_text = _fetch_readme_md(session, name)
        if readme_text is None:
            readme_text = _fetch_readme_from_build_yaml(session, name)
        if readme_text is None:
            continue

        desc = parse_readme_description(readme_text)
        if desc:
            descriptions[name] = desc

    print(
        f"Fetched descriptions for {len(descriptions)}/{len(app_names)} apps",
        flush=True,
    )
    return descriptions


def _fetch_readme_md(session: requests.Session, name: str) -> Optional[str]:
    """Return the raw README.md text, or None on 404 / error."""
    url = f"{README_BASE_URL}/{name}/README.md"
    try:
        resp = session.get(
            url, timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS)
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.text
    except requests.RequestException:
        return None


def _fetch_readme_from_build_yaml(session: requests.Session, name: str) -> Optional[str]:
    """
    Fetch ``build.yaml`` and extract the ``readme:`` field value.

    The field is a YAML multi-line scalar (``|`` or ``|-``).  Rather than
    adding a PyYAML dependency we extract it with a simple regex/parser:
    find the ``readme:`` key, then collect all subsequent indented lines.
    """
    url = f"{README_BASE_URL}/{name}/build.yaml"
    try:
        resp = session.get(
            url, timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS)
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
    except requests.RequestException:
        return None

    return _extract_yaml_readme_field(resp.text)


def _extract_yaml_readme_field(yaml_text: str) -> Optional[str]:
    """
    Pull the ``readme`` block-scalar value out of a YAML file without
    a YAML parser.  Handles ``readme: |``, ``readme: |-``, and
    ``readme: |+`` style block scalars.
    """
    lines = yaml_text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if re.match(r"^readme:\s*[|>]", line):
            start = i + 1
            break
    if start is None:
        return None

    # Collect indented continuation lines
    content_lines: List[str] = []
    for line in lines[start:]:
        # A non-empty, non-indented line ends the block scalar
        if line and not line[0].isspace():
            break
        # Strip the leading indentation (typically 2 spaces)
        content_lines.append(line.lstrip())

    return "\n".join(content_lines) if content_lines else None


def parse_readme_description(readme_text: str) -> Optional[str]:
    """
    Extract the description from a neurocontainers README.md.

    The format is:
        ----------------------------------
        ## app/version ##
        Description paragraph(s) here.

        Example:
        ```
        ...
        ```

    We capture lines after the ``## ... ##`` title until we hit a line that
    starts a new section (``Example:``, ``---``, a code fence, ``More
    documentation``, ``To setup``, ``Licensing``, or another ``## ``).
    """
    lines = readme_text.splitlines()

    # Find the section-title line (## ... ##)
    start = None
    for i, line in enumerate(lines):
        if re.match(r"^##\s+.+##\s*$", line):
            start = i + 1
            break

    if start is None:
        return None

    # Stop markers: things that typically end the description block
    stop_pattern = re.compile(
        r"^(##\s|```|Example|---+$|More documentation|To setup|Licensing|Usage)",
        re.IGNORECASE,
    )

    desc_lines: List[str] = []
    for line in lines[start:]:
        stripped = line.strip()
        if stop_pattern.match(stripped):
            break
        desc_lines.append(stripped)

    # Trim leading/trailing blank lines, collapse to single string
    text = "\n".join(desc_lines).strip()
    # Collapse multiple blank lines into one space for a compact description
    text = re.sub(r"\n{2,}", " ", text)
    text = re.sub(r"\n", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text if text else None


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

    # Collect unique app names and fetch their README descriptions
    unique_app_names = sorted(set(app.rsplit("_", 2)[0] for app in app_list))
    descriptions = fetch_app_descriptions(session, unique_app_names)

    # Write application, categories, doi, doi_url, and description to applist.json
    val = []
    for app in app_list:
        app_name = app.rsplit("_", 2)[0]
        categories = get_app_categories(menu_entries, app_name)

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
                if app_name in descriptions:
                    entry["description"] = descriptions[app_name]
                val.append(entry)
                found_doi = True
                break
        if not found_doi:
            entry = {"application": app, "categories": categories}
            if app_name in descriptions:
                entry["description"] = descriptions[app_name]
            val.append(entry)
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
