const assert = require("assert");
const { InstallCommandBuilder } = require("../util/installCommandBuilder");

suite("InstallCommandBuilder Test Suite", () => {

  const ws = "my-org";
  const repo = "my-repo";

  test("python generates pip install with index-url", () => {
    const result = InstallCommandBuilder.build("python", "flask", "3.0.0", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\npip install 'flask'=='3.0.0' --index-url https://dl.cloudsmith.io/basic/my-org/my-repo/python/simple/"
    );
    assert.ok(result.note);
    assert.ok(result.note.includes("basic"));
  });

  test("npm generates npm install with registry", () => {
    const result = InstallCommandBuilder.build("npm", "lodash", "4.17.21", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\nnpm install 'lodash'@'4.17.21' --registry=https://npm.cloudsmith.io/my-org/my-repo/"
    );
    assert.ok(result.note);
  });

  test("maven generates pom.xml snippet with groupId:artifactId split", () => {
    const result = InstallCommandBuilder.build("maven", "org.springframework:spring-core", "5.3.20", ws, repo);
    assert.ok(result.command.includes("<groupId>org.springframework</groupId>"));
    assert.ok(result.command.includes("<artifactId>spring-core</artifactId>"));
    assert.ok(result.command.includes("<version>5.3.20</version>"));
    assert.ok(result.command.includes(`https://dl.cloudsmith.io/basic/${ws}/${repo}/maven/`));
  });

  test("maven handles name without colon", () => {
    const result = InstallCommandBuilder.build("maven", "my-artifact", "1.0.0", ws, repo);
    assert.ok(result.command.includes("<groupId>my-artifact</groupId>"));
    assert.ok(result.command.includes("<artifactId>my-artifact</artifactId>"));
  });

  test("nuget generates dotnet add package", () => {
    const result = InstallCommandBuilder.build("nuget", "Newtonsoft.Json", "13.0.3", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\ndotnet add package 'Newtonsoft.Json' --version '13.0.3' --source https://nuget.cloudsmith.io/my-org/my-repo/v3/index.json"
    );
  });

  test("docker generates tag-based pull command", () => {
    const result = InstallCommandBuilder.build("docker", "nginx", "1.25", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\ndocker pull docker.cloudsmith.io/my-org/my-repo/nginx:1.25"
    );
    assert.ok(result.note);
    assert.ok(result.note.includes("docker login"));
    assert.ok(!result.alternatives, "No alternatives without digest opts");
  });

  test("docker falls back to latest when version is empty", () => {
    const result = InstallCommandBuilder.build("docker", "nginx", "", ws, repo);
    assert.ok(result.command.includes("nginx:latest"));
  });

  test("docker includes digest alternative when checksumSha256 provided", () => {
    const result = InstallCommandBuilder.build("docker", "nginx", "1.25", ws, repo, {
      checksumSha256: "abc123def456",
    });
    assert.ok(result.command.includes("nginx:1.25"), "Primary is tag-based");
    assert.ok(result.alternatives, "Should have alternatives");
    assert.strictEqual(result.alternatives.length, 1);
    assert.ok(result.alternatives[0].command.includes("nginx@sha256:abc123def456"));
    assert.ok(result.alternatives[0].label.includes("digest"));
  });

  test("docker has no digest alternative when checksumSha256 is missing", () => {
    const result = InstallCommandBuilder.build("docker", "nginx", "1.25", ws, repo, {});
    assert.ok(!result.alternatives, "No alternatives without checksum");
  });

  test("helm generates helm install with repo URL", () => {
    const result = InstallCommandBuilder.build("helm", "my-chart", "1.0.0", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\nhelm install 'my-chart' --repo https://dl.cloudsmith.io/basic/my-org/my-repo/helm/charts/ --version '1.0.0'"
    );
  });

  test("cargo generates cargo add with registry note", () => {
    const result = InstallCommandBuilder.build("cargo", "serde", "1.0.0", ws, repo);
    assert.strictEqual(result.command, "# Verify package details before running\ncargo add 'serde'@'1.0.0'");
    assert.ok(result.note);
    assert.ok(result.note.includes(".cargo/config.toml"));
    assert.ok(result.note.includes(`cargo.cloudsmith.io/${ws}/${repo}`));
  });

  test("go generates go get with GONOSUMCHECK", () => {
    const result = InstallCommandBuilder.build("go", "github.com/gin-gonic/gin", "1.9.1", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\nGONOSUMCHECK='github.com/gin-gonic/gin' go get 'github.com/gin-gonic/gin'@v'1.9.1'"
    );
    assert.ok(result.note);
    assert.ok(result.note.includes("GOPROXY"));
  });

  test("ruby generates gem install", () => {
    const result = InstallCommandBuilder.build("ruby", "rails", "7.0.0", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\ngem install 'rails' -v '7.0.0' --source https://dl.cloudsmith.io/basic/my-org/my-repo/ruby/"
    );
  });

  test("conda generates conda install", () => {
    const result = InstallCommandBuilder.build("conda", "numpy", "1.24.0", ws, repo);
    assert.strictEqual(
      result.command,
      "# Verify package details before running\nconda install -c https://conda.cloudsmith.io/my-org/my-repo/ 'numpy'='1.24.0'"
    );
    assert.strictEqual(result.note, null);
  });

  test("composer generates composer require with repo note", () => {
    const result = InstallCommandBuilder.build("composer", "vendor/package", "2.0.0", ws, repo);
    assert.strictEqual(result.command, "# Verify package details before running\ncomposer require 'vendor/package':'2.0.0'");
    assert.ok(result.note);
    assert.ok(result.note.includes("composer.json"));
  });

  test("dart generates dart pub add with hosted note", () => {
    const result = InstallCommandBuilder.build("dart", "my_pkg", "1.0.0", ws, repo);
    assert.strictEqual(result.command, "# Verify package details before running\ndart pub add 'my_pkg':'1.0.0'");
    assert.ok(result.note);
    assert.ok(result.note.includes("pubspec.yaml"));
  });

  test("rpm generates dnf install with yum alternative", () => {
    const result = InstallCommandBuilder.build("rpm", "httpd", "2.4.57", ws, repo);
    assert.ok(result.command.includes("dnf install"));
    assert.ok(result.command.includes("'httpd'-'2.4.57'"));
    assert.ok(result.note);
    assert.ok(result.note.includes("yum.repos.d"));
    assert.ok(result.alternatives);
    assert.strictEqual(result.alternatives.length, 1);
    assert.ok(result.alternatives[0].command.includes("yum install"));
    assert.ok(result.alternatives[0].command.includes("'httpd'-'2.4.57'"));
  });

  test("raw generates curl download with wget alternative", () => {
    const result = InstallCommandBuilder.build("raw", "myfile", "1.0.0", ws, repo, {
      cdnUrl: "https://cdn.example.com/myfile-1.0.0.tar.gz",
    });
    assert.ok(result.command.includes("curl -L -O"));
    assert.ok(result.command.includes("https://cdn.example.com/myfile-1.0.0.tar.gz"));
    assert.ok(result.alternatives);
    assert.strictEqual(result.alternatives.length, 1);
    assert.ok(result.alternatives[0].command.includes("wget"));
    assert.ok(result.alternatives[0].command.includes("https://cdn.example.com/myfile-1.0.0.tar.gz"));
  });

  test("raw constructs URL when cdnUrl is missing", () => {
    const result = InstallCommandBuilder.build("raw", "myfile", "1.0.0", ws, repo, {
      filename: "myfile-1.0.0.tar.gz",
    });
    assert.ok(result.command.includes("dl.cloudsmith.io/basic/my-org/my-repo/raw/names/myfile/versions/1.0.0/myfile-1.0.0.tar.gz"));
  });

  test("raw uses name-version as filename fallback", () => {
    const result = InstallCommandBuilder.build("raw", "myfile", "1.0.0", ws, repo);
    assert.ok(result.command.includes("raw/names/myfile/versions/1.0.0/myfile-1.0.0"));
  });

  test("generic routes to raw handler", () => {
    const result = InstallCommandBuilder.build("generic", "myfile", "1.0.0", ws, repo, {
      cdnUrl: "https://cdn.example.com/file.bin",
    });
    assert.ok(result.command.includes("curl -L -O"));
    assert.ok(result.command.includes("https://cdn.example.com/file.bin"));
  });

  test("unknown format returns comment with link", () => {
    const result = InstallCommandBuilder.build("unknown_format", "pkg", "1.0", ws, repo);
    assert.ok(result.command.startsWith("#"));
    assert.ok(result.command.includes("unknown_format"));
    assert.ok(result.note);
    assert.ok(result.note.includes(`app.cloudsmith.com/${ws}/${repo}`));
  });

  test("all private-repo formats have a note", () => {
    const privateFormats = ["python", "npm", "maven", "nuget", "docker", "helm", "cargo", "go", "ruby", "rpm", "raw"];
    for (const fmt of privateFormats) {
      const result = InstallCommandBuilder.build(fmt, "pkg", "1.0", ws, repo);
      assert.ok(result.note, `${fmt} should have a note about private repos`);
    }
  });

  test("shell commands safely escape embedded single quotes", () => {
    const result = InstallCommandBuilder.build("npm", "evil'pkg", "1.0.0", ws, repo);
    assert.ok(result.command.includes("'evil'\\''pkg'"));
  });

  test("maven escapes XML-sensitive values", () => {
    const result = InstallCommandBuilder.build("maven", "group<&>:artifact\"name", "1.0<&>\"", ws, repo);
    assert.ok(result.command.includes("<groupId>group&lt;&amp;&gt;</groupId>"));
    assert.ok(result.command.includes("<artifactId>artifact&quot;name</artifactId>"));
    assert.ok(result.command.includes("<version>1.0&lt;&amp;&gt;&quot;</version>"));
  });
});
