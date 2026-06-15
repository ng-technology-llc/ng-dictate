import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const localMaterials = join(root, "local-release-materials");
const tauriConfigPath = join(root, "src-tauri", "tauri.conf.json");
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

function main(): void {
  console.log("Release readiness check");

  checkLocalMaterialsIgnored();
  for (const file of requiredFiles) {
    checkFileExists(file);
    checkOwnerOnly(file);
  }
  checkUpdaterPublicKey();
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
