"""Exercise the production workflow's actual EDU copy and redirect commands.

Run with Python, rsync and Node.js installed:
    python -m unittest tests/test_promote_edu.py -v
"""

import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import textwrap
import unittest


WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/promote-to-prod.yml"


def step_text(name):
    match = re.search(r"^      - name: " + re.escape(name) + r"\n(.*?)(?=^      - |\Z)",
                      WORKFLOW.read_text(), re.MULTILINE | re.DOTALL)
    if match is None:
        raise AssertionError(f"Missing workflow step: {name}")
    return match[1]


def files(root):
    return {path.relative_to(root).as_posix(): path.read_bytes()
            for path in root.rglob("*") if path.is_file()}


class EduAssemblyTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(shutil.which("rsync"), "Tests require rsync")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.runner = self.root / "runner"
        self.source = self.runner / "neurodeskedu"
        for name in (
            "index.html", "intro.html", ".nojekyll", "examples/topic/index.html",
            "examples/preview/index.html", "_static/widgets/view.html", "build/chunk.js",
            "_sources/test.ipynb", ".git/config", "preview/index.html",
            "preview/examples/topic/index.html", "preview/_static/large.bin",
        ):
            self.write(self.source / name, name.encode())
        self.write(self.root / "dist/index.html", b"main website")
        self.write(self.root / "dist/neurocontainers-ui/index.html", b"other app")
        self.before = files(self.source)
        helper = self.root / ".github/workflows/check-site-size.py"
        self.write(helper, (WORKFLOW.parent / "check-site-size.py").read_bytes())

    def write(self, path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def run_step(self, name):
        script = textwrap.dedent(step_text(name).split("        run: |\n", 1)[1])
        script = script.replace("${{ runner.temp }}", str(self.runner))
        script = script.replace("${{ inputs.include_edu }}", "true")
        return subprocess.run(["bash", "-euo", "pipefail", "-c", script], cwd=self.root,
                              env={**os.environ, "NEURODESKEDU_DIR": str(self.source)},
                              text=True, capture_output=True, check=True)

    def test_copy_keeps_production_files_and_removes_stale_preview(self):
        destination = self.root / "dist/edu"
        self.write(destination / "preview/stale.html", b"old preview")
        self.write(destination / "obsolete.html", b"old production file")
        self.run_step("Include NeurodeskEDU")
        expected = {name: content for name, content in self.before.items()
                    if name.split("/")[0] not in {".git", "preview"}}
        self.assertEqual(files(destination), expected)
        self.assertEqual(files(self.source), self.before)
        self.assertEqual((self.root / "dist/index.html").read_bytes(), b"main website")
        self.assertEqual((self.root / "dist/neurocontainers-ui/index.html").read_bytes(), b"other app")
        self.run_step("Include NeurodeskEDU")
        self.assertEqual(files(destination), expected)

    def test_legacy_redirects_exclude_preview_but_keep_public_routes(self):
        destination = self.root / "dist/example-notebooks"
        self.write(destination / "preview/stale.html", b"old staging redirect")
        self.write(destination / "old-asset.bin", b"old asset")
        self.run_step("Generate legacy example notebooks redirects")
        expected = {name for name in self.before if name.endswith(".html")
                    and name.split("/")[0] not in {".git", "build", "_static", "preview"}}
        self.assertEqual(set(files(destination)), expected)
        for name in expected:
            with self.subTest(name=name):
                text = (destination / name).read_text()
                path = name.removesuffix("index.html") if name.endswith("index.html") else name
                target = "https://neurodesk.org/edu/" + path
                self.assertIn("url=" + html.escape(target, quote=True), text)
                script = re.search(r"<script>(.*?)</script>", text)[1]
                result = subprocess.run(
                    ["node", "-e", 'const location = {search: "?check=1", hash: "#test", '
                     'replace: value => console.log(JSON.stringify(value))}; ' + script],
                    text=True, capture_output=True, check=True,
                )
                self.assertEqual(json.loads(result.stdout), target + "?check=1#test")
        first = files(destination)
        self.run_step("Generate legacy example notebooks redirects")
        self.assertEqual(files(destination), first)
        self.assertEqual(files(self.source), self.before)

    def test_source_without_preview_remains_compatible(self):
        shutil.rmtree(self.source / "preview")
        self.run_step("Include NeurodeskEDU")
        self.assertEqual(files(self.root / "dist/edu"),
                         {name: data for name, data in files(self.source).items()
                          if name.split("/")[0] != ".git"})

    def test_actual_candidate_size_is_checked_before_publication(self):
        self.run_step("Include NeurodeskEDU")
        self.run_step("Generate legacy example notebooks redirects")
        self.write(self.root / "dist/CNAME", b"neurodesk.org\n")
        self.write(self.root / "dist/.hidden", b"hidden content is published too")
        result = self.run_step("Verify assembled production candidate")
        size = sum(len(data) for data in files(self.root / "dist").values())
        self.assertIn(f"{size:,} bytes", result.stdout)
        # A sparse file tests the boundary without allocating a GB of disk space.
        with (self.root / "dist/large.bin").open("wb") as stream:
            stream.truncate(1_000_000_000 - size)
        self.run_step("Verify assembled production candidate")
        with (self.root / "dist/large.bin").open("ab") as stream:
            stream.write(b"x")
        with self.assertRaises(subprocess.CalledProcessError) as failure:
            self.run_step("Verify assembled production candidate")
        self.assertIn("exceeds the 1 GB GitHub Pages budget", failure.exception.stderr)

    def test_final_worktree_counts_retained_edu_and_excludes_only_git(self):
        worktree = self.root / "production"
        self.write(worktree / "edu/retained.bin", b"retained EDU")
        self.write(worktree / ".git/config", b"git internals")
        # A large Git metadata file must not count toward published bytes.
        with (worktree / ".git/config").open("wb") as stream:
            stream.truncate(1_000_000_001)
        self.write(self.root / "dist/.hidden", b"hidden published content")
        step = textwrap.dedent(step_text("Push candidate to production repository").split("        run: |\n", 1)[1])
        script = step[step.index('if [ "$INCLUDE_EDU" = "true" ]; then'):step.index('cd "$PROD_WORKTREE"')]
        env = {**os.environ, "INCLUDE_EDU": "false", "PROD_WORKTREE": str(worktree)}
        subprocess.run(["bash", "-euo", "pipefail", "-c", script], cwd=self.root,
                       env=env, text=True, capture_output=True, check=True)
        self.assertEqual((worktree / "edu/retained.bin").read_bytes(), b"retained EDU")
        self.assertEqual((worktree / ".hidden").read_bytes(), b"hidden published content")
        self.assertEqual((worktree / ".git/config").stat().st_size, 1_000_000_001)
        # Retained EDU must still be included in the final site's budget check.
        with (worktree / "edu/retained.bin").open("wb") as stream:
            stream.truncate(1_000_000_000)
        with self.assertRaises(subprocess.CalledProcessError) as failure:
            subprocess.run(["bash", "-euo", "pipefail", "-c", script], cwd=self.root,
                           env=env, text=True, capture_output=True, check=True)
        self.assertIn("exceeds the 1 GB GitHub Pages budget", failure.exception.stderr)
        self.assertLess(step.index('check-site-size.py "$PROD_WORKTREE"'), step.index("git add -A"))

    def test_size_check_rejects_file_directory_and_dangling_symlinks(self):
        self.run_step("Include NeurodeskEDU")
        self.run_step("Generate legacy example notebooks redirects")
        self.write(self.root / "dist/CNAME", b"neurodesk.org\n")
        link = self.root / "dist/link"
        for target in [self.root / "dist/index.html", self.source, self.root / "missing"]:
            with self.subTest(target=target):
                link.symlink_to(target)
                try:
                    with self.assertRaises(subprocess.CalledProcessError) as failure:
                        self.run_step("Verify assembled production candidate")
                    self.assertIn("cannot contain symbolic links", failure.exception.stderr)
                finally:
                    link.unlink()

    def test_copy_remains_optional(self):
        self.assertIn("if: ${{ inputs.include_edu }}", step_text("Include NeurodeskEDU"))
        self.assertIn("--exclude=edu/", step_text("Push candidate to production repository"))


if __name__ == "__main__":
    unittest.main()
