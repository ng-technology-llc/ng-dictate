import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { randomUUID } from "crypto";

const root = resolve(import.meta.dirname, "..");
const localMaterials = join(root, "local-release-materials");
const packageJsonPath = join(root, "package.json");
const tauriConfigPath = join(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = join(root, "src-tauri", "Cargo.toml");
const appleCertDir = join(
  localMaterials,
  "apple-developer-id",
  "developer-id-application-20260614-221337",
);
const updaterDir = join(localMaterials, "tauri-updater", "production");
const repo = "ng-technology-llc/ng-dictate";

const requiredFiles = [
  join(appleCertDir, "developer-id-application.key"),
  join(appleCertDir, "developerID_application.cer"),
  join(appleCertDir, "developerID_application.pem"),
  join(appleCertDir, "developerID_application.p12"),
  join(appleCertDir, "developerID_application.p12.base64"),
  join(appleCertDir, "developerID_application.p12.password"),
  join(appleCertDir, "DeveloperIDG2CA.cer"),
  join(appleCertDir, "DeveloperIDG2CA.pem"),
  join(updaterDir, "ng-dictate-updater.key"),
  join(updaterDir, "ng-dictate-updater.key.pub"),
  join(updaterDir, "ng-dictate-updater.key.password"),
];

const requiredSecrets = [
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_ID",
  "APPLE_ID_PASSWORD",
  "APPLE_PASSWORD",
  "APPLE_TEAM_ID",
  "KEYCHAIN_PASSWORD",
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
];

const errors: string[] = [];

function run(command: string[], cwd = root) {
  const result = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function fail(message: string): void {
  errors.push(message);
}

function checkFileExists(path: string): void {
  if (!existsSync(path)) {
    fail(`Missing local release material: ${path}`);
  }
}

function checkOwnerOnly(path: string): void {
  if (!existsSync(path)) return;

  const mode = statSync(path).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    fail(`Local release material is readable by group/others: ${path}`);
  }
}

function checkLocalMaterialsIgnored(): void {
  const result = run([
    "git",
    "check-ignore",
    "-q",
    "local-release-materials/test",
  ]);
  if (result.exitCode !== 0) {
    fail("local-release-materials/ is not ignored by git");
  }
}

function checkUpdaterPublicKey(): void {
  if (!existsSync(tauriConfigPath)) {
    fail(`Missing Tauri config: ${tauriConfigPath}`);
    return;
  }

  const updaterPublicKeyPath = join(updaterDir, "ng-dictate-updater.key.pub");
  if (!existsSync(updaterPublicKeyPath)) return;

  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
    plugins?: { updater?: { pubkey?: string } };
  };
  const configuredPubkey = tauriConfig.plugins?.updater?.pubkey?.trim();
  const localPubkey = readFileSync(updaterPublicKeyPath, "utf8").trim();

  if (configuredPubkey !== localPubkey) {
    fail(
      "src-tauri/tauri.conf.json updater pubkey does not match local production updater public key",
    );
  }
}

function checkTauriConfigDoesNotUseUpstreamSettings(): void {
  if (!existsSync(tauriConfigPath)) return;

  const tauriConfig = readFileSync(tauriConfigPath, "utf8");
  const legacyPatterns = [
    "github.com/cjpais/Handy/releases",
    "CJ-Signing",
    "com.pais.handy",
  ];

  for (const pattern of legacyPatterns) {
    if (tauriConfig.includes(pattern)) {
      fail(
        `src-tauri/tauri.conf.json still contains upstream setting: ${pattern}`,
      );
    }
  }
}

function checkReleaseVersion(): void {
  if (!existsSync(tauriConfigPath)) {
    fail(`Missing Tauri config: ${tauriConfigPath}`);
    return;
  }

  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
    version?: string;
  };
  const version = tauriConfig.version?.trim();

  if (!version) {
    fail("src-tauri/tauri.conf.json does not define a release version");
    return;
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`Release version is not semver-like: ${version}`);
  }

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      version?: string;
    };
    if (packageJson.version !== version) {
      fail(
        `package.json version (${packageJson.version ?? "missing"}) does not match Tauri version (${version})`,
      );
    }
  }

  if (existsSync(cargoTomlPath)) {
    const cargoToml = readFileSync(cargoTomlPath, "utf8");
    const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    if (cargoVersion !== version) {
      fail(
        `src-tauri/Cargo.toml version (${cargoVersion ?? "missing"}) does not match Tauri version (${version})`,
      );
    }
  }

  const tagName = `v${version}`;
  const localTag = run([
    "git",
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/tags/${tagName}`,
  ]);
  if (localTag.exitCode === 0) {
    fail(`Release tag already exists locally: ${tagName}`);
  } else if (localTag.exitCode !== 1) {
    fail(
      `Unable to check local release tag ${tagName}: ${localTag.stderr.trim()}`,
    );
  }

  const remoteTag = run([
    "git",
    "ls-remote",
    "--exit-code",
    "--tags",
    "origin",
    `refs/tags/${tagName}`,
  ]);
  if (remoteTag.exitCode === 0) {
    fail(`Release tag already exists on origin: ${tagName}`);
  } else if (remoteTag.exitCode !== 2) {
    fail(
      `Unable to check origin release tag ${tagName}: ${remoteTag.stderr.trim()}`,
    );
  }

  const release = run([
    "gh",
    "release",
    "view",
    tagName,
    "-R",
    repo,
    "--json",
    "url",
  ]);
  if (release.exitCode === 0) {
    const url = JSON.parse(release.stdout) as { url?: string };
    fail(`GitHub release already exists for ${tagName}: ${url.url ?? repo}`);
  } else if (
    !`${release.stdout}\n${release.stderr}`.toLowerCase().includes("not found")
  ) {
    fail(`Unable to check GitHub release ${tagName}: ${release.stderr.trim()}`);
  }
}

function checkGitHubSecrets(): void {
  const result = run(["gh", "secret", "list", "-R", repo]);
  if (result.exitCode !== 0) {
    fail(`Unable to list GitHub secrets for ${repo}: ${result.stderr.trim()}`);
    return;
  }

  const configured = new Set(
    result.stdout
      .split("\n")
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean),
  );

  for (const secret of requiredSecrets) {
    if (!configured.has(secret)) {
      fail(`Missing GitHub Actions secret: ${secret}`);
    }
  }
}

function checkP12ImportsWithSecurity(): void {
  if (process.platform !== "darwin") return;

  const p12Path = join(appleCertDir, "developerID_application.p12");
  const p12PasswordPath = join(
    appleCertDir,
    "developerID_application.p12.password",
  );
  if (!existsSync(p12Path) || !existsSync(p12PasswordPath)) return;

  const tempDir = mkdtempSync(join(tmpdir(), "ng-dictate-release-check-"));
  const keychainPath = join(tempDir, "release-check.keychain");
  const copiedP12Path = join(tempDir, "certificate.p12");
  const keychainPassword = randomUUID();
  const p12Password = readFileSync(p12PasswordPath, "utf8");
  const originalDefaultKeychain = run([
    "security",
    "default-keychain",
    "-d",
    "user",
  ])
    .stdout.trim()
    .replace(/^"|"$/g, "");
  const originalKeychains = run(["security", "list-keychains", "-d", "user"])
    .stdout.split("\n")
    .map((line) => line.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  const keychainToRestore = originalDefaultKeychain || originalKeychains[0];

  function security(command: string[]): ReturnType<typeof run> {
    return run(["security", ...command]);
  }

  try {
    copyFileSync(p12Path, copiedP12Path);

    const commands = [
      ["create-keychain", "-p", keychainPassword, keychainPath],
      [
        "list-keychains",
        "-d",
        "user",
        "-s",
        keychainPath,
        ...originalKeychains,
      ],
      ["default-keychain", "-s", keychainPath],
      ["unlock-keychain", "-p", keychainPassword, keychainPath],
      [
        "import",
        copiedP12Path,
        "-k",
        keychainPath,
        "-P",
        p12Password,
        "-T",
        "/usr/bin/codesign",
      ],
      [
        "set-key-partition-list",
        "-S",
        "apple-tool:,apple:,codesign:",
        "-s",
        "-k",
        keychainPassword,
        keychainPath,
      ],
    ];

    for (const command of commands) {
      const result = security(command);
      if (result.exitCode !== 0) {
        fail(
          `Developer ID .p12 failed macOS security import check: ${result.stderr.trim()}`,
        );
        return;
      }
    }

    const identity = security([
      "find-identity",
      "-v",
      "-p",
      "codesigning",
      keychainPath,
    ]);
    if (
      identity.exitCode !== 0 ||
      !identity.stdout.includes("Developer ID Application: ng technology llc")
    ) {
      fail(
        "Developer ID .p12 does not expose a valid macOS codesigning identity",
      );
    }
  } finally {
    if (originalKeychains.length > 0) {
      security(["list-keychains", "-d", "user", "-s", ...originalKeychains]);
    }
    if (keychainToRestore) {
      security(["default-keychain", "-d", "user", "-s", keychainToRestore]);
    }
    security(["delete-keychain", keychainPath]);
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main(): void {
  console.log("Release readiness check");

  checkLocalMaterialsIgnored();
  for (const file of requiredFiles) {
    checkFileExists(file);
    checkOwnerOnly(file);
  }
  checkReleaseVersion();
  checkUpdaterPublicKey();
  checkTauriConfigDoesNotUseUpstreamSettings();
  checkP12ImportsWithSecurity();
  checkGitHubSecrets();

  if (errors.length > 0) {
    console.error("\nRelease readiness failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Release readiness passed.");
}

main();
