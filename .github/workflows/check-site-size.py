#!/usr/bin/env python3
"""Check all publishable files against a conservative GitHub Pages size budget."""

import argparse
import os
from pathlib import Path


LIMIT_BYTES = 1_000_000_000


def check_site(root: Path) -> int:
    if root.is_symlink():
        raise ValueError(f"GitHub Pages artifacts cannot contain symbolic links: {root}")
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"Missing site directory: {root}")
    size = 0

    def fail(error):
        raise error

    for directory, directories, filenames in os.walk(root, followlinks=False, onerror=fail):
        folder = Path(directory)
        # The production worktree has Git internals that are never published.
        if folder == root:
            directories[:] = [name for name in directories if name != ".git"]
            filenames = [name for name in filenames if name != ".git"]
        for name in directories + filenames:
            path = folder / name
            if path.is_symlink():
                raise ValueError(f"GitHub Pages artifacts cannot contain symbolic links: {path}")
            if path.is_file():
                # Count every path (including hidden files), not allocated blocks or
                # deduplicated inodes: Git publishes a separate blob at each path.
                size += path.stat().st_size
    print(f"Site candidate: {size:,} bytes")
    if size > LIMIT_BYTES:
        raise ValueError("Assembled site exceeds the 1 GB GitHub Pages budget")
    return size


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    try:
        check_site(args.directory)
    except ValueError as error:
        raise SystemExit(str(error)) from error
