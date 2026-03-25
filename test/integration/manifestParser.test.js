const assert = require('assert');
const { ManifestParser } = require('../../util/manifestParser');

suite('Integration: Manifest Parser', function () {

  suite('parseNpm', function () {
    test('parses dependencies and devDependencies from package.json', function () {
      const content = JSON.stringify({
        dependencies: {
          express: '^4.18.0',
          lodash: '~4.17.21',
        },
        devDependencies: {
          mocha: '^10.0.0',
        },
      });

      const deps = ManifestParser.parseNpm(content, 'npm');
      assert.strictEqual(deps.length, 3);

      const express = deps.find((d) => d.name === 'express');
      assert.ok(express, 'Should find express');
      assert.strictEqual(express.version, '4.18.0');
      assert.strictEqual(express.devDependency, false);
      assert.strictEqual(express.format, 'npm');

      const mocha = deps.find((d) => d.name === 'mocha');
      assert.ok(mocha, 'Should find mocha');
      assert.strictEqual(mocha.devDependency, true);
    });

    test('handles empty dependencies', function () {
      const deps = ManifestParser.parseNpm('{}', 'npm');
      assert.ok(Array.isArray(deps));
      assert.strictEqual(deps.length, 0);
    });

    test('handles malformed JSON gracefully', function () {
      const deps = ManifestParser.parseNpm('not json at all', 'npm');
      assert.ok(Array.isArray(deps));
      assert.strictEqual(deps.length, 0);
    });

    test('strips version prefixes (^, ~, >=)', function () {
      const content = JSON.stringify({
        dependencies: {
          a: '^1.0.0',
          b: '~2.3.4',
          c: '>=3.0.0',
          d: '4.0.0',
        },
      });
      const deps = ManifestParser.parseNpm(content, 'npm');
      assert.strictEqual(deps.find((d) => d.name === 'a').version, '1.0.0');
      assert.strictEqual(deps.find((d) => d.name === 'b').version, '2.3.4');
      assert.strictEqual(deps.find((d) => d.name === 'c').version, '3.0.0');
      assert.strictEqual(deps.find((d) => d.name === 'd').version, '4.0.0');
    });
  });

  suite('parsePythonRequirements', function () {
    test('parses requirements.txt lines with operators', function () {
      const content = 'flask==3.0.0\nrequests>=2.31.0\nclick~=8.1.0\n';
      const deps = ManifestParser.parsePythonRequirements(content, 'python');
      assert.strictEqual(deps.length, 3);

      const flask = deps.find((d) => d.name === 'flask');
      assert.ok(flask, 'Should find flask');
      assert.strictEqual(flask.version, '3.0.0');
      assert.strictEqual(flask.format, 'python');
    });

    test('skips comments and blank lines', function () {
      const content = '# This is a comment\nflask==3.0.0\n\n# another comment\n';
      const deps = ManifestParser.parsePythonRequirements(content, 'python');
      assert.strictEqual(deps.length, 1);
      assert.strictEqual(deps[0].name, 'flask');
    });

    test('skips -r includes and --index-url flags', function () {
      const content = '-r base.txt\n--index-url https://example.com\nflask==3.0.0\n';
      const deps = ManifestParser.parsePythonRequirements(content, 'python');
      assert.strictEqual(deps.length, 1);
      assert.strictEqual(deps[0].name, 'flask');
    });

    test('handles empty content', function () {
      const deps = ManifestParser.parsePythonRequirements('', 'python');
      assert.ok(Array.isArray(deps));
      assert.strictEqual(deps.length, 0);
    });
  });

  suite('parseGoMod', function () {
    test('parses require block', function () {
      const content = [
        'module github.com/myorg/myapp',
        '',
        'go 1.21',
        '',
        'require (',
        '\tgithub.com/gin-gonic/gin v1.9.1',
        '\tgithub.com/stretchr/testify v1.8.4',
        ')',
      ].join('\n');
      const deps = ManifestParser.parseGoMod(content, 'go');
      assert.ok(deps.length >= 2, `Expected >= 2 deps, got ${deps.length}`);

      const gin = deps.find((d) => d.name === 'github.com/gin-gonic/gin');
      assert.ok(gin, 'Should find gin');
      assert.strictEqual(gin.version, '1.9.1');
      assert.strictEqual(gin.format, 'go');
    });
  });

  suite('parseMaven', function () {
    test('extracts dependency blocks from pom.xml', function () {
      const content = [
        '<project>',
        '  <dependencies>',
        '    <dependency>',
        '      <groupId>org.springframework</groupId>',
        '      <artifactId>spring-core</artifactId>',
        '      <version>6.1.0</version>',
        '    </dependency>',
        '  </dependencies>',
        '</project>',
      ].join('\n');
      const deps = ManifestParser.parseMaven(content, 'maven');
      assert.ok(deps.length >= 1, 'Should find at least one dependency');

      const spring = deps.find((d) => d.name.includes('spring-core'));
      assert.ok(spring, 'Should find spring-core');
      assert.strictEqual(spring.version, '6.1.0');
    });

    test('skips dependencies with property-reference versions', function () {
      const content = [
        '<project>',
        '  <dependencies>',
        '    <dependency>',
        '      <groupId>com.example</groupId>',
        '      <artifactId>my-lib</artifactId>',
        '      <version>${project.version}</version>',
        '    </dependency>',
        '  </dependencies>',
        '</project>',
      ].join('\n');
      const deps = ManifestParser.parseMaven(content, 'maven');
      assert.strictEqual(deps.length, 0, 'Should skip property-reference versions');
    });
  });
});
