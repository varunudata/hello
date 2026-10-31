const parser = require("@babel/parser");
const traverseModule = require("@babel/traverse");
const traverse = traverseModule.default || traverseModule;

const CODE_EXTENSIONS = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
};

function getExtension(filePath) {
  const idx = filePath.lastIndexOf(".");
  return idx !== -1 ? filePath.slice(idx).toLowerCase() : "";
}

function getFolder(filePath) {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "root";
  return parts.slice(0, -1).join("/");
}

/**
 * Parse JavaScript / TypeScript source code into an Abstract Syntax Tree (AST)
 * using @babel/parser and extract functions, imports, exports, call expressions,
 * AST node counts, and cyclomatic complexity.
 */
function parseJsTsWithBabelAst(code, filePath, language) {
  const imports = [];
  const exportsList = [];
  const functions = [];
  let fileAstNodeCount = 0;

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "unambiguous",
      errorRecovery: true,
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "dynamicImport",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
    });
  } catch {
    return null;
  }

  const lines = code.split(/\r?\n/);

  const extractFunctionNode = (path, name, kind, isExported = false) => {
    const node = path.node;
    const startLine = node.loc ? node.loc.start.line : 1;
    const endLine = node.loc ? node.loc.end.line : startLine;
    const lineCount = Math.max(1, endLine - startLine + 1);
    const snippetLines = lines.slice(
      Math.max(0, startLine - 1),
      Math.min(lines.length, startLine + 17)
    );
    const codeSnippet = snippetLines.join("\n");
    const fullBodyText = lines
      .slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine))
      .join("\n");

    const params = (node.params || []).map((p) => {
      if (p.type === "Identifier") return p.name;
      if (p.type === "AssignmentPattern" && p.left?.name) return `${p.left.name}=…`;
      if (p.type === "RestElement" && p.argument?.name) return `...${p.argument.name}`;
      if (p.type === "ObjectPattern") return "{…}";
      if (p.type === "ArrayPattern") return "[…]";
      return "arg";
    });

    let complexity = 1;
    let fnAstNodes = 0;
    const rawCalls = new Set();
    const referencedIdentifiers = new Set();

    path.traverse({
      enter(childPath) {
        fnAstNodes++;
        const t = childPath.node.type;
        if (
          t === "IfStatement" ||
          t === "ForStatement" ||
          t === "ForInStatement" ||
          t === "ForOfStatement" ||
          t === "WhileStatement" ||
          t === "DoWhileStatement" ||
          t === "CatchClause" ||
          t === "ConditionalExpression"
        ) {
          complexity++;
        } else if (t === "SwitchCase" && childPath.node.test) {
          complexity++;
        } else if (
          t === "LogicalExpression" &&
          (childPath.node.operator === "&&" ||
            childPath.node.operator === "||" ||
            childPath.node.operator === "??")
        ) {
          complexity++;
        } else if (t === "CallExpression") {
          const callee = childPath.node.callee;
          if (callee.type === "Identifier") {
            rawCalls.add(callee.name);
          } else if (
            callee.type === "MemberExpression" &&
            callee.property?.type === "Identifier"
          ) {
            rawCalls.add(callee.property.name);
            if (callee.object?.type === "Identifier") {
              referencedIdentifiers.add(callee.object.name);
            }
          }
        } else if (t === "Identifier") {
          referencedIdentifiers.add(childPath.node.name);
        }
      },
    });

    const asyncPrefix = node.async ? "async " : "";
    const signature = `${asyncPrefix}function ${name}(${params.join(", ")})`;

    functions.push({
      id: `${filePath}::${name}`,
      name,
      signature,
      file: filePath,
      folder: getFolder(filePath),
      language,
      kind,
      isAsync: Boolean(node.async),
      isExported,
      params,
      startLine,
      endLine,
      lineCount,
      sizeBytes: Buffer.byteLength(fullBodyText, "utf8"),
      astNodes: fnAstNodes,
      complexity,
      rawCalls: Array.from(rawCalls),
      referencedIdentifiers: Array.from(referencedIdentifiers),
      codeSnippet,
    });
  };

  const seenNames = new Set();

  traverse(ast, {
    enter() {
      fileAstNodeCount++;
    },
    ImportDeclaration(path) {
      const source = path.node.source?.value || "";
      const specifiers = (path.node.specifiers || [])
        .map((s) => s.local?.name)
        .filter(Boolean);
      const isExternal = !source.startsWith(".") && !source.startsWith("/");
      imports.push({ source, specifiers, isExternal });
    },
    CallExpression(path) {
      // Also capture CommonJS require("...")
      const callee = path.node.callee;
      const arg = path.node.arguments?.[0];
      if (
        callee.type === "Identifier" &&
        callee.name === "require" &&
        arg?.type === "StringLiteral"
      ) {
        const source = arg.value;
        const isExternal = !source.startsWith(".") && !source.startsWith("/");
        const specifiers = [];
        if (path.parent.type === "VariableDeclarator") {
          if (path.parent.id.type === "Identifier") {
            specifiers.push(path.parent.id.name);
          } else if (path.parent.id.type === "ObjectPattern") {
            for (const prop of path.parent.id.properties || []) {
              if (prop.value?.name) specifiers.push(prop.value.name);
              else if (prop.key?.name) specifiers.push(prop.key.name);
            }
          }
        }
        imports.push({ source, specifiers, isExternal });
      }

      // Express-style route handlers: router.post("/login", async (req, res) => {})
      if (
        callee.type === "MemberExpression" &&
        callee.property?.type === "Identifier" &&
        ["get", "post", "put", "delete", "patch", "use"].includes(
          callee.property.name
        )
      ) {
        const routeArg = path.node.arguments?.[0];
        const handlerArg =
          path.node.arguments?.[path.node.arguments.length - 1];
        if (
          routeArg?.type === "StringLiteral" &&
          handlerArg &&
          (handlerArg.type === "ArrowFunctionExpression" ||
            handlerArg.type === "FunctionExpression")
        ) {
          const method = callee.property.name.toUpperCase();
          const cleanRoute =
            routeArg.value === "/"
              ? "root"
              : routeArg.value.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "");
          const routeFnName = `${method}_${cleanRoute || "handler"}`;
          if (!seenNames.has(routeFnName)) {
            seenNames.add(routeFnName);
            const argPaths = path.get("arguments");
            const handlerPath = argPaths[argPaths.length - 1];
            extractFunctionNode(handlerPath, routeFnName, "route-handler", true);
          }
        }
      }
    },
    ExportNamedDeclaration(path) {
      if (path.node.declaration?.id?.name) {
        exportsList.push(path.node.declaration.id.name);
      }
      for (const spec of path.node.specifiers || []) {
        if (spec.exported?.name) exportsList.push(spec.exported.name);
      }
    },
    ExportDefaultDeclaration(path) {
      if (path.node.declaration?.id?.name) {
        exportsList.push(path.node.declaration.id.name);
      } else {
        exportsList.push("default");
      }
    },
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (!name || seenNames.has(name)) return;
      seenNames.add(name);
      const isExported =
        path.parent.type === "ExportNamedDeclaration" ||
        path.parent.type === "ExportDefaultDeclaration";
      extractFunctionNode(path, name, "function", isExported);
    },
    VariableDeclarator(path) {
      const id = path.node.id;
      const init = path.node.init;
      if (!id || id.type !== "Identifier" || !init) return;
      const name = id.name;
      if (seenNames.has(name)) return;

      if (
        init.type === "ArrowFunctionExpression" ||
        init.type === "FunctionExpression"
      ) {
        seenNames.add(name);
        const isExported =
          path.parentPath?.parent?.type === "ExportNamedDeclaration";
        extractFunctionNode(path.get("init"), name, "arrow", isExported);
      }
    },
    ClassMethod(path) {
      const methodName = path.node.key?.name;
      if (!methodName || methodName === "constructor") return;
      const classNode = path.findParent((p) => p.isClassDeclaration());
      const className = classNode?.node?.id?.name || "Class";
      const fullName = `${className}.${methodName}`;
      if (seenNames.has(fullName)) return;
      seenNames.add(fullName);
      extractFunctionNode(path, fullName, "class-method", false);
    },
  });

  return {
    imports,
    exports: exportsList,
    functions,
    astNodeCount: fileAstNodeCount,
  };
}

/**
 * Fallback structured syntax parser for Python, Go, Rust, Java
 */
function parseOtherLanguageSyntax(code, filePath, language) {
  const lines = code.split(/\r?\n/);
  const imports = [];
  const functions = [];
  let astNodeCount = lines.length * 4;

  // Match imports
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (language === "Python") {
      const m1 = trimmed.match(/^from\s+([^\s]+)\s+import\s+(.+)$/);
      const m2 = trimmed.match(/^import\s+([^\s]+)/);
      if (m1) {
        imports.push({
          source: m1[1],
          specifiers: m1[2].split(",").map((s) => s.trim()),
          isExternal: !m1[1].startsWith("."),
        });
      } else if (m2) {
        imports.push({
          source: m2[1],
          specifiers: [m2[1]],
          isExternal: !m2[1].startsWith("."),
        });
      }
    } else if (language === "Go" || language === "Rust" || language === "Java") {
      const m = trimmed.match(/^(?:import|use)\s+["']?([^"';\s]+)["']?/);
      if (m) {
        imports.push({
          source: m[1],
          specifiers: [m[1].split("/").pop()],
          isExternal: true,
        });
      }
    }
  });

  // Match function blocks
  const fnRegex =
    language === "Python"
      ? /^\s*(async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/
      : language === "Go"
      ? /^\s*func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/
      : language === "Rust"
      ? /^\s*(?:pub\s+)?(async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/
      : /^\s*(?:public|private|protected)\s+(?:static\s+)?[a-zA-Z0-9_<>[\]]+\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fnRegex);
    if (!match) continue;

    const isAsync = Boolean(
      (language === "Python" || language === "Rust") && match[1]
    );
    const name =
      language === "Python" || language === "Rust" ? match[2] : match[1];
    const rawParams =
      (language === "Python" || language === "Rust" ? match[3] : match[2]) || "";
    const params = rawParams
      .split(",")
      .map((s) => s.trim().split(/[\s:]/)[0])
      .filter(Boolean);

    const startLine = i + 1;
    let endLine = Math.min(lines.length, startLine + 24);
    for (let j = i + 1; j < Math.min(lines.length, i + 80); j++) {
      if (lines[j].match(fnRegex)) {
        endLine = j;
        break;
      }
    }

    const bodySlice = lines.slice(i, endLine).join("\n");
    const branchMatches =
      bodySlice.match(/\b(if|elif|else|for|while|match|case|catch|&&|\|\|)\b/g) ||
      [];
    const callMatches = Array.from(
      bodySlice.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)
    )
      .map((m) => m[1])
      .filter(
        (fn) =>
          fn !== name &&
          !["if", "for", "while", "switch", "catch", "print", "len", "range"].includes(
            fn
          )
      );

    functions.push({
      id: `${filePath}::${name}`,
      name,
      signature: `${isAsync ? "async " : ""}fn ${name}(${params.join(", ")})`,
      file: filePath,
      folder: getFolder(filePath),
      language,
      kind: "function",
      isAsync,
      isExported: true,
      params,
      startLine,
      endLine,
      lineCount: Math.max(1, endLine - startLine + 1),
      sizeBytes: Buffer.byteLength(bodySlice, "utf8"),
      astNodes: Math.max(12, (endLine - startLine + 1) * 5),
      complexity: 1 + branchMatches.length,
      rawCalls: Array.from(new Set(callMatches)),
      referencedIdentifiers: Array.from(new Set(callMatches)),
      codeSnippet: lines.slice(i, Math.min(lines.length, i + 16)).join("\n"),
    });
  }

  return {
    imports,
    exports: functions.map((f) => f.name),
    functions,
    astNodeCount,
  };
}

/**
 * Given a list of { path, content } source files + manifest files,
 * builds the complete AST analysis, function call graph, blast radius,
 * and criticality report.
 */
function buildRepositoryAnalysis({
  repoName,
  fullName,
  repoUrl,
  description,
  defaultBranch = "main",
  sourceFiles = [],
  packageJsonList = [],
  requirementsTxt = "",
}) {
  const parsedFiles = [];
  const allFunctions = [];
  const languageTotals = {};
  let totalLines = 0;
  let totalAstNodes = 0;

  // 1. Parse all packages from package.json / requirements.txt
  const packageMap = new Map();
  for (const pkgJson of packageJsonList) {
    try {
      const parsed =
        typeof pkgJson === "string" ? JSON.parse(pkgJson) : pkgJson;
      const deps = parsed.dependencies || {};
      const devDeps = parsed.devDependencies || {};
      for (const [name, version] of Object.entries(deps)) {
        packageMap.set(name, {
          name,
          version: String(version),
          type: "production",
          ecosystem: "npm",
          usedInFilesCount: 0,
        });
      }
      for (const [name, version] of Object.entries(devDeps)) {
        if (!packageMap.has(name)) {
          packageMap.set(name, {
            name,
            version: String(version),
            type: "development",
            ecosystem: "npm",
            usedInFilesCount: 0,
          });
        }
      }
    } catch {
      // ignore malformed package.json
    }
  }

  if (requirementsTxt) {
    requirementsTxt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .forEach((line) => {
        const [pkgName, ver] = line.split(/==|>=|~=/);
        if (pkgName) {
          packageMap.set(pkgName.trim(), {
            name: pkgName.trim(),
            version: ver ? ver.trim() : "latest",
            type: "production",
            ecosystem: "pip",
            usedInFilesCount: 0,
          });
        }
      });
  }

  // 2. Parse each source file using AST
  for (const fileObj of sourceFiles) {
    const ext = getExtension(fileObj.path);
    const language = CODE_EXTENSIONS[ext];
    if (!language || !fileObj.content) continue;

    const linesCount = fileObj.content.split(/\r?\n/).length;
    totalLines += linesCount;

    if (!languageTotals[language]) {
      languageTotals[language] = { name: language, ext, files: 0, lines: 0 };
    }
    languageTotals[language].files += 1;
    languageTotals[language].lines += linesCount;

    let astResult = null;
    if (language === "TypeScript" || language === "JavaScript") {
      astResult = parseJsTsWithBabelAst(fileObj.content, fileObj.path, language);
    }
    if (!astResult) {
      astResult = parseOtherLanguageSyntax(
        fileObj.content,
        fileObj.path,
        language
      );
    }

    totalAstNodes += astResult.astNodeCount || 0;

    // Count external package usage
    for (const imp of astResult.imports) {
      if (imp.isExternal) {
        const basePkg = imp.source.startsWith("@")
          ? imp.source.split("/").slice(0, 2).join("/")
          : imp.source.split("/")[0];
        if (packageMap.has(basePkg)) {
          packageMap.get(basePkg).usedInFilesCount += 1;
        } else if (basePkg && !["fs", "path", "crypto", "http", "https", "url", "os", "util", "events", "stream"].includes(basePkg)) {
          packageMap.set(basePkg, {
            name: basePkg,
            version: "detected",
            type: "production",
            ecosystem: language === "Python" ? "pip" : "npm",
            usedInFilesCount: 1,
          });
        }
      }
    }

    const fileComplexity = astResult.functions.reduce(
      (sum, fn) => sum + fn.complexity,
      1
    );

    parsedFiles.push({
      path: fileObj.path,
      folder: getFolder(fileObj.path),
      name: fileObj.path.split("/").pop(),
      language,
      lines: linesCount,
      sizeBytes: Buffer.byteLength(fileObj.content, "utf8"),
      imports: astResult.imports,
      exports: astResult.exports,
      functionCount: astResult.functions.length,
      complexity: fileComplexity,
    });

    for (const fn of astResult.functions) {
      fn.fileImports = astResult.imports;
      allFunctions.push(fn);
    }
  }

  // 3. Build cross-file & cross-function AST call graph and blast radius
  const functionsByName = new Map();
  const functionById = new Map();
  for (const fn of allFunctions) {
    functionById.set(fn.id, fn);
    if (!functionsByName.has(fn.name)) {
      functionsByName.set(fn.name, []);
    }
    functionsByName.get(fn.name).push(fn);
  }

  // Resolve file-level imports so we know which files import which other files
  const fileImportedByMap = new Map(); // targetFile -> Set(callerFile)
  for (const f of parsedFiles) {
    fileImportedByMap.set(f.path, new Set());
  }

  for (const f of parsedFiles) {
    for (const imp of f.imports) {
      if (!imp.isExternal) {
        const cleanTarget = imp.source
          .replace(/^\.\//, "")
          .replace(/^\.\.\//, "");
        const matchedFile = parsedFiles.find(
          (cand) =>
            cand.path !== f.path &&
            (cand.path.endsWith(cleanTarget) ||
              cand.path.replace(/\.(ts|tsx|js|jsx|py|go|rs|java)$/, "").endsWith(cleanTarget))
        );
        if (matchedFile) {
          fileImportedByMap.get(matchedFile.path)?.add(f.path);
        }
      }
    }
  }

  const functionEdges = [];
  const edgeSet = new Set();

  // Initialize caller/callee arrays on each function
  for (const fn of allFunctions) {
    fn.callsFunctions = [];
    fn.calledByFunctions = [];
    fn.usedByFilesSet = new Set();
  }

  // Link function calls (AST CallExpression -> target Function)
  for (const callerFn of allFunctions) {
    for (const calledName of callerFn.rawCalls) {
      const targets = functionsByName.get(calledName) || [];
      if (!targets.length) continue;

      // Prefer target in same file or imported file
      const targetFn =
        targets.find((t) => t.file === callerFn.file && t.id !== callerFn.id) ||
        targets.find((t) => t.id !== callerFn.id);

      if (targetFn) {
        const edgeId = `${callerFn.id}->${targetFn.id}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          callerFn.callsFunctions.push({
            id: targetFn.id,
            name: targetFn.name,
            file: targetFn.file,
          });
          targetFn.calledByFunctions.push({
            id: callerFn.id,
            name: callerFn.name,
            file: callerFn.file,
          });
          targetFn.usedByFilesSet.add(callerFn.file);

          functionEdges.push({
            id: edgeId,
            source: callerFn.id,
            target: targetFn.id,
            sourceName: callerFn.name,
            targetName: targetFn.name,
            sourceFile: callerFn.file,
            targetFile: targetFn.file,
            type: "calls",
          });
        }
      }
    }
  }

  // Also include file-level importers in `usedByFilesSet` for exported functions
  for (const fn of allFunctions) {
    if (fn.isExported) {
      const importingFiles = fileImportedByMap.get(fn.file) || new Set();
      for (const impFile of importingFiles) {
        fn.usedByFilesSet.add(impFile);
      }
    }
  }

  // Compute transitive blast radius (if this function is changed or removed, which files are affected?)
  const totalFileCount = Math.max(1, parsedFiles.length);

  for (const fn of allFunctions) {
    const directFiles = new Set(fn.usedByFilesSet);
    directFiles.add(fn.file); // the defining file itself

    // BFS upstream through callers & file importers to find full transitive impact
    const impactedFiles = new Set(directFiles);
    const queue = [...fn.calledByFunctions.map((c) => c.id)];
    const visitedFn = new Set([fn.id]);

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visitedFn.has(currId)) continue;
      visitedFn.add(currId);

      const currFn = functionById.get(currId);
      if (!currFn) continue;
      impactedFiles.add(currFn.file);
      for (const fPath of currFn.usedByFilesSet) {
        impactedFiles.add(fPath);
      }
      for (const upstreamCaller of currFn.calledByFunctions) {
        if (!visitedFn.has(upstreamCaller.id)) {
          queue.push(upstreamCaller.id);
        }
      }
    }

    // Also traverse 1 hop of file-level importers of any impacted file
    for (const fPath of Array.from(impactedFiles)) {
      const importers = fileImportedByMap.get(fPath);
      if (importers) {
        for (const imp of importers) impactedFiles.add(imp);
      }
    }

    const usedByFiles = Array.from(fn.usedByFilesSet);
    const affectedFilesIfChanged = Array.from(impactedFiles);
    const usedByFilesCount = usedByFiles.length;
    const affectedFilesCount = affectedFilesIfChanged.length;
    const blastRadiusPercent = Math.min(
      100,
      Math.round((affectedFilesCount / totalFileCount) * 100)
    );

    // Filter importedDependencies relevant to this function or file
    const importedDependencies = (fn.fileImports || []).map((imp) => ({
      source: imp.source,
      specifiers: imp.specifiers,
      isExternal: imp.isExternal,
    }));

    // Calculate Criticality Score (0-100) & Level
    const rawScore = Math.min(
      99,
      Math.round(
        usedByFilesCount * 14 +
          affectedFilesCount * 8 +
          fn.complexity * 3.5 +
          (fn.isExported ? 10 : 0) +
          Math.min(15, fn.lineCount / 4)
      )
    );

    let criticality = "LOW";
    if (rawScore >= 72 || affectedFilesCount >= 5 || fn.complexity >= 14) {
      criticality = "CRITICAL";
    } else if (rawScore >= 48 || affectedFilesCount >= 3 || fn.complexity >= 8) {
      criticality = "HIGH";
    } else if (rawScore >= 26 || affectedFilesCount >= 2 || fn.complexity >= 4) {
      criticality = "MODERATE";
    }

    const criticalityReason =
      criticality === "CRITICAL"
        ? `Core architectural function: modifying or removing ${fn.name}() directly impacts ${affectedFilesCount} files (${blastRadiusPercent}% of project) with cyclomatic complexity ${fn.complexity}.`
        : criticality === "HIGH"
        ? `High-impact function referenced across ${affectedFilesCount} files (${blastRadiusPercent}% blast radius) with ${fn.calledByFunctions.length} upstream callers.`
        : criticality === "MODERATE"
        ? `Moderate coupling: affects ${affectedFilesCount} file(s) with cyclomatic complexity ${fn.complexity}.`
        : `Isolated helper function scoped primarily to ${fn.file} with minimal downstream blast radius.`;

    fn.importedDependencies = importedDependencies;
    fn.usedByFiles = usedByFiles;
    fn.usedByFilesCount = usedByFilesCount;
    fn.affectedFilesIfChanged = affectedFilesIfChanged;
    fn.affectedFilesCount = affectedFilesCount;
    fn.blastRadiusPercent = blastRadiusPercent;
    fn.criticality = criticality;
    fn.criticalityScore = rawScore;
    fn.criticalityReason = criticalityReason;
  }

  for (const fn of allFunctions) {
    delete fn.rawCalls;
    delete fn.referencedIdentifiers;
    delete fn.fileImports;
    delete fn.usedByFilesSet;
  }

  // Sort functions by criticalityScore descending
  allFunctions.sort((a, b) => b.criticalityScore - a.criticalityScore);

  const languages = Object.values(languageTotals)
    .sort((a, b) => b.lines - a.lines)
    .map((l) => ({
      ...l,
      percentage: Math.max(
        1,
        Math.round((l.lines / Math.max(1, totalLines)) * 100)
      ),
    }));

  const primaryLanguage = languages[0]?.name || "TypeScript";
  const packages = Array.from(packageMap.values()).sort(
    (a, b) => b.usedInFilesCount - a.usedInFilesCount
  );

  // Compute overall architecture health score
  const criticalFnCount = allFunctions.filter(
    (f) => f.criticality === "CRITICAL"
  ).length;
  const avgComplexity =
    allFunctions.length > 0
      ? +(
          allFunctions.reduce((acc, f) => acc + f.complexity, 0) /
          allFunctions.length
        ).toFixed(1)
      : 1.0;

  const healthScore = Math.max(
    64,
    Math.min(
      98,
      Math.round(100 - criticalFnCount * 2.5 - Math.max(0, avgComplexity - 3) * 3)
    )
  );

  return {
    repoName,
    fullName,
    repoUrl,
    description:
      description ||
      `AST-indexed repository (${parsedFiles.length} files, ${allFunctions.length} functions parsed).`,
    defaultBranch,
    primaryLanguage,
    fileCount: parsedFiles.length,
    functionCount: allFunctions.length,
    packageCount: packages.length,
    dependencyCount:
      functionEdges.length +
      parsedFiles.reduce((acc, f) => acc + f.imports.length, 0),
    totalLines,
    astNodeCount: totalAstNodes,
    healthScore,
    avgComplexity,
    criticalFnCount,
    languages,
    packages,
    files: parsedFiles,
    functions: allFunctions,
    functionEdges,
  };
}

module.exports = {
  buildRepositoryAnalysis,
  CODE_EXTENSIONS,
  getExtension,
};
