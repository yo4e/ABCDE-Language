"""Generated data integrity and full structured-result parity with Python."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from tools.build_static import render
from tools.static_cases import cases, expected

ROOT = Path(__file__).resolve().parents[1]


class StaticViewerTests(unittest.TestCase):
    def test_generated_data_is_current(self):
        self.assertEqual(render(), (ROOT / "docs/data.js").read_text(encoding="utf-8"),
                         "Run python3 tools/build_static.py with the reference Python version")

    def test_assets_are_relative_and_local(self):
        from html.parser import HTMLParser

        class Assets(HTMLParser):
            paths = []

            def handle_starttag(self, tag, attrs):
                values = dict(attrs)
                if tag in ("script", "link"):
                    self.paths.append(values.get("src", values.get("href")))

        parser = Assets()
        parser.feed((ROOT / "docs/index.html").read_text(encoding="utf-8"))
        for asset in parser.paths:
            if asset.startswith("data:"):
                continue
            self.assertTrue(asset.startswith("./"))
            self.assertTrue((ROOT / "docs" / asset).is_file())
        self.assertTrue((ROOT / "docs/.nojekyll").exists())

    @unittest.skipUnless(shutil.which("node"), "Node is needed only for JS parity tests, not for the viewer")
    def test_javascript_matches_python_full_json(self):
        corpus = cases()
        proc = subprocess.run(["node", "tools/run_static.cjs"], cwd=ROOT, input=json.dumps(corpus),
                              text=True, capture_output=True, timeout=60)
        self.assertEqual(0, proc.returncode, proc.stderr)
        outputs = json.loads(proc.stdout)
        self.assertEqual(len(corpus), len(outputs))
        for case, output in zip(corpus, outputs):
            with self.subTest(source=case["source"], text=case["text"][:100], conventions=case["conventions"]):
                self.assertEqual(expected(case), output)


if __name__ == "__main__":
    unittest.main()
