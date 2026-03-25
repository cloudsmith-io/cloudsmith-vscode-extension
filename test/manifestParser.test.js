const assert = require("assert");
const { ManifestParser } = require("../util/manifestParser");

suite("ManifestParser Test Suite", () => {

  // =====================
  // parseNpm
  // =====================

  suite("parseNpm", () => {
    test("parses dependencies and devDependencies", () => {
      const content = JSON.stringify({
        dependencies: {
          "express": "^4.18.2",
          "lodash": "~4.17.21",
        },
        devDependencies: {
          "mocha": ">=10.0.0",
          "eslint": "9.25.1",
        },
      });
      const result = ManifestParser.parseNpm(content, "npm");
      assert.strictEqual(result.length, 4);

      assert.strictEqual(result[0].name, "express");
      assert.strictEqual(result[0].version, "4.18.2");
      assert.strictEqual(result[0].devDependency, false);
      assert.strictEqual(result[0].format, "npm");

      assert.strictEqual(result[1].name, "lodash");
      assert.strictEqual(result[1].version, "4.17.21");

      assert.strictEqual(result[2].name, "mocha");
      assert.strictEqual(result[2].version, "10.0.0");
      assert.strictEqual(result[2].devDependency, true);

      assert.strictEqual(result[3].name, "eslint");
      assert.strictEqual(result[3].version, "9.25.1");
    });

    test("handles empty package.json", () => {
      const result = ManifestParser.parseNpm("{}", "npm");
      assert.strictEqual(result.length, 0);
    });

    test("handles malformed JSON gracefully", () => {
      const result = ManifestParser.parseNpm("not json at all", "npm");
      assert.strictEqual(result.length, 0);
    });

    test("handles package.json with no dependencies key", () => {
      const content = JSON.stringify({ name: "my-app", version: "1.0.0" });
      const result = ManifestParser.parseNpm(content, "npm");
      assert.strictEqual(result.length, 0);
    });
  });

  // =====================
  // parsePythonRequirements
  // =====================

  suite("parsePythonRequirements", () => {
    test("parses standard requirements with operators", () => {
      const content = [
        "flask==2.3.0",
        "requests>=2.28.0",
        "numpy~=1.24.0",
        "pandas<=2.0.0",
      ].join("\n");
      const result = ManifestParser.parsePythonRequirements(content, "python");
      assert.strictEqual(result.length, 4);
      assert.strictEqual(result[0].name, "flask");
      assert.strictEqual(result[0].version, "2.3.0");
      assert.strictEqual(result[1].name, "requests");
      assert.strictEqual(result[1].version, "2.28.0");
      assert.strictEqual(result[2].name, "numpy");
      assert.strictEqual(result[2].version, "1.24.0");
      assert.strictEqual(result[3].name, "pandas");
      assert.strictEqual(result[3].version, "2.0.0");
    });

    test("skips comments, blank lines, and flags", () => {
      const content = [
        "# This is a comment",
        "",
        "flask==2.3.0",
        "--index-url https://pypi.org/simple",
        "-r other-requirements.txt",
        "requests>=2.28.0",
        "-e git+https://github.com/user/project.git",
      ].join("\n");
      const result = ManifestParser.parsePythonRequirements(content, "python");
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, "flask");
      assert.strictEqual(result[1].name, "requests");
    });

    test("handles bare package names without version", () => {
      const content = "flask\nrequests\n";
      const result = ManifestParser.parsePythonRequirements(content, "python");
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, "flask");
      assert.strictEqual(result[0].version, "");
    });

    test("handles extras in brackets", () => {
      const content = "requests[security]>=2.28.0\n";
      const result = ManifestParser.parsePythonRequirements(content, "python");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "requests");
      assert.strictEqual(result[0].version, "2.28.0");
    });

    test("handles empty file", () => {
      const result = ManifestParser.parsePythonRequirements("", "python");
      assert.strictEqual(result.length, 0);
    });
  });

  // =====================
  // parseMaven
  // =====================

  suite("parseMaven", () => {
    test("extracts dependencies from pom.xml", () => {
      const content = `
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.20</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>`;
      const result = ManifestParser.parseMaven(content, "maven");
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, "org.springframework:spring-core");
      assert.strictEqual(result[0].version, "5.3.20");
      assert.strictEqual(result[0].devDependency, false);
      assert.strictEqual(result[1].name, "junit:junit");
      assert.strictEqual(result[1].devDependency, true);
    });

    test("skips dependencies with property references", () => {
      const content = `
<project>
  <dependencies>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>module-a</artifactId>
      <version>\${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>module-b</artifactId>
      <version>1.0.0</version>
    </dependency>
  </dependencies>
</project>`;
      const result = ManifestParser.parseMaven(content, "maven");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "com.example:module-b");
    });

    test("handles empty pom.xml", () => {
      const result = ManifestParser.parseMaven("<project></project>", "maven");
      assert.strictEqual(result.length, 0);
    });
  });

  // =====================
  // parseGoMod
  // =====================

  suite("parseGoMod", () => {
    test("parses require block", () => {
      const content = `module example.com/myproject

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/stretchr/testify v1.8.4 // indirect
	golang.org/x/text v0.14.0
)`;
      const result = ManifestParser.parseGoMod(content, "go");
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].name, "github.com/gin-gonic/gin");
      assert.strictEqual(result[0].version, "1.9.1");
      assert.strictEqual(result[0].devDependency, false);
      assert.strictEqual(result[1].name, "github.com/stretchr/testify");
      assert.strictEqual(result[1].version, "1.8.4");
      assert.strictEqual(result[1].devDependency, true); // indirect
    });

    test("handles single-line require", () => {
      const content = `module example.com/myproject

require github.com/gin-gonic/gin v1.9.1
`;
      const result = ManifestParser.parseGoMod(content, "go");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "github.com/gin-gonic/gin");
      assert.strictEqual(result[0].version, "1.9.1");
    });

    test("handles empty go.mod", () => {
      const content = "module example.com/myproject\n\ngo 1.21\n";
      const result = ManifestParser.parseGoMod(content, "go");
      assert.strictEqual(result.length, 0);
    });
  });

  // =====================
  // parseCargo
  // =====================

  suite("parseCargo", () => {
    test("parses simple and complex dependencies", () => {
      const content = `[package]
name = "my-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.28", features = ["full"] }

[dev-dependencies]
criterion = "0.5"
`;
      const result = ManifestParser.parseCargo(content, "cargo");
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].name, "serde");
      assert.strictEqual(result[0].version, "1.0");
      assert.strictEqual(result[0].devDependency, false);
      assert.strictEqual(result[1].name, "tokio");
      assert.strictEqual(result[1].version, "1.28");
      assert.strictEqual(result[2].name, "criterion");
      assert.strictEqual(result[2].devDependency, true);
    });

    test("handles empty Cargo.toml", () => {
      const content = "[package]\nname = \"empty\"\n";
      const result = ManifestParser.parseCargo(content, "cargo");
      assert.strictEqual(result.length, 0);
    });

    test("strips version prefixes", () => {
      const content = `[dependencies]
serde = "^1.0.0"
tokio = "~1.28.0"
`;
      const result = ManifestParser.parseCargo(content, "cargo");
      assert.strictEqual(result[0].version, "1.0.0");
      assert.strictEqual(result[1].version, "1.28.0");
    });
  });

  // =====================
  // parsePyproject
  // =====================

  suite("parsePyproject", () => {
    test("parses Poetry-style dependencies", () => {
      const content = `[tool.poetry.dependencies]
python = "^3.9"
flask = "^2.3.0"
requests = {version = "^2.28.0", optional = true}
`;
      const result = ManifestParser.parsePyproject(content, "python");
      assert.strictEqual(result.length, 2); // python is skipped
      assert.strictEqual(result[0].name, "flask");
      assert.strictEqual(result[0].version, "2.3.0");
      assert.strictEqual(result[1].name, "requests");
      assert.strictEqual(result[1].version, "2.28.0");
    });

    test("handles empty pyproject.toml", () => {
      const result = ManifestParser.parsePyproject("", "python");
      assert.strictEqual(result.length, 0);
    });
  });

  // =====================
  // _stripVersionPrefix
  // =====================

  suite("_stripVersionPrefix", () => {
    test("strips ^ prefix", () => {
      assert.strictEqual(ManifestParser._stripVersionPrefix("^4.18.2"), "4.18.2");
    });

    test("strips ~ prefix", () => {
      assert.strictEqual(ManifestParser._stripVersionPrefix("~4.17.21"), "4.17.21");
    });

    test("strips >= prefix", () => {
      assert.strictEqual(ManifestParser._stripVersionPrefix(">=2.28.0"), "2.28.0");
    });

    test("strips ~= prefix", () => {
      assert.strictEqual(ManifestParser._stripVersionPrefix("~=1.24.0"), "1.24.0");
    });

    test("handles bare version", () => {
      assert.strictEqual(ManifestParser._stripVersionPrefix("1.0.0"), "1.0.0");
    });

    test("handles null/undefined", () => {
      assert.strictEqual(ManifestParser._stripVersionPrefix(null), "");
      assert.strictEqual(ManifestParser._stripVersionPrefix(undefined), "");
    });
  });
});
