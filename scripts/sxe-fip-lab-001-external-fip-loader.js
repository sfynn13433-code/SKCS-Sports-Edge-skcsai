'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_CANONICAL_BYTES,
  SCOUT_PUBLISHED_TIP,
  REQUIRED_FIELD_PATHS,
  canonicalJson,
  sha256Upper,
  validateCanonicalScoutFip
} = require('./sxe-fip-lab-001-canonical-validator');

const CANONICAL_ROLE = 'CANONICAL_SCOUT_FIP';
const INTERNAL_ROLE = 'INTERNAL_SCOUT_FIP';
const DTO_ROLE = 'CONSUMER_SAFE_EDGE_DTO';

const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;

function loaderError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function holdFromLoader(code, message, details = {}) {
  return {
    result: 'HOLD',
    code,
    message,
    details
  };
}

function isUrlLike(value) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(String(value || ''))
    || /^\\\\/.test(String(value || ''));
}

function isLocalFile(filePath, label) {
  if (isUrlLike(filePath)) {
    throw loaderError(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      `${label} must be an explicit local file, not a URL or network location.`,
      { value: String(filePath) }
    );
  }

  const resolved = path.resolve(String(filePath || ''));
  let stat;

  try {
    stat = fs.statSync(resolved);
  } catch (_error) {
    throw loaderError(
      'SXE_CANONICAL_SCOUT_FIP_MISSING',
      `${label} does not exist.`,
      { path: resolved }
    );
  }

  if (!stat.isFile()) {
    throw loaderError(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      `${label} must resolve to a regular file.`,
      { path: resolved }
    );
  }

  return resolved;
}

function resolveContainedPath(root, candidatePath, label) {
  const resolvedRoot = fs.realpathSync.native
    ? fs.realpathSync.native(root)
    : fs.realpathSync(root);
  const resolvedCandidate = path.resolve(String(candidatePath || ''));
  let resolvedFile;

  try {
    resolvedFile = fs.realpathSync.native
      ? fs.realpathSync.native(resolvedCandidate)
      : fs.realpathSync(resolvedCandidate);
  } catch (_error) {
    throw loaderError(
      'SXE_CANONICAL_SCOUT_FIP_MISSING',
      `${label} does not exist.`,
      { path: resolvedCandidate }
    );
  }

  const relative = path.relative(resolvedRoot, resolvedFile);
  if (
    relative.startsWith(`..${path.sep}`)
    || relative === '..'
    || path.isAbsolute(relative)
  ) {
    throw loaderError(
      'SXE_EXTERNAL_PATH_ESCAPE',
      `${label} resolves outside the allowed handoff root.`,
      { path: resolvedFile, allowed_root: resolvedRoot }
    );
  }

  return resolvedFile;
}

function hasPath(value, dottedPath) {
  let cursor = value;

  for (const part of dottedPath.split('.')) {
    if (
      !cursor
      || typeof cursor !== 'object'
      || !Object.prototype.hasOwnProperty.call(cursor, part)
    ) {
      return false;
    }
    cursor = cursor[part];
  }

  return true;
}

function fixtureIdentity(value) {
  return value?.fixture_id
    || value?.scout?.fixture_id
    || value?.fixture?.fixture_id
    || value?.selection?.fixture_id
    || value?.fip?.fixture_id;
}

function assertFixtureConsistency(manifest, verifiedFiles) {
  const expected = manifest.fixture?.fixture_id;
  if (!expected) {
    throw loaderError(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      'The handoff manifest must declare fixture.fixture_id.'
    );
  }

  for (const file of verifiedFiles) {
    const actual = fixtureIdentity(file.parsed);
    if (actual && actual !== expected) {
      throw loaderError(
        'SXE_CANONICAL_IDENTITY_UNRESOLVED',
        `Handoff fixture identity differs from the manifest for ${file.role}.`,
        { role: file.role, expected, actual }
      );
    }
  }
}

function missingCanonicalFields(value) {
  return REQUIRED_FIELD_PATHS.filter((field) => !hasPath(value, field));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    freezeDeep(child);
  }

  return Object.freeze(value);
}

function parseJsonAfterHash(file, expectedHash, role) {
  const bytes = fs.readFileSync(file);

  if (bytes.length >= MAX_CANONICAL_BYTES) {
    throw loaderError(
      'SXE_EXTERNAL_FIP_TOO_LARGE',
      `Verified handoff file ${role} exceeds the 256 KB intake bound.`,
      { role, path: file, bytes: bytes.length }
    );
  }

  const normalizedExpected = String(expectedHash || '').trim();
  if (!SHA256_PATTERN.test(normalizedExpected)) {
    throw loaderError(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      `Manifest sha256 for ${role} is malformed.`,
      { role, sha256: expectedHash }
    );
  }

  const actualHash = sha256Upper(bytes);

  if (actualHash !== normalizedExpected.toUpperCase()) {
    throw loaderError(
      'SXE_EXTERNAL_BYTE_HASH_MISMATCH',
      `Exact-byte SHA-256 verification failed for ${role}.`,
      { role, path: file, expected: normalizedExpected, actual: actualHash }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw loaderError(
      'SXE_CANONICAL_JSON_INVALID',
      `Verified handoff file ${role} is not valid JSON.`,
      { role, path: file, cause: error.message }
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw loaderError(
      'SXE_CANONICAL_JSON_INVALID',
      `Verified handoff file ${role} must contain a JSON object.`,
      { role, path: file }
    );
  }

  return { bytes, actualHash, parsed };
}

function loadExternalScoutFip(options = {}) {
  const now = options.now === undefined ? new Date() : options.now;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(nowMs)) {
    return holdFromLoader('SXE_CANONICAL_KICKOFF_INELIGIBLE', 'Injectable clock is not a valid Date.');
  }
  const clock = now instanceof Date ? now : new Date(nowMs);

  const requestedManifest = options.manifestPath || process.env.SXE_HANDOFF_MANIFEST_PATH;
  if (!requestedManifest) {
    return holdFromLoader(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      'Provide --manifest <local path> or SXE_HANDOFF_MANIFEST_PATH.'
    );
  }

  if (isUrlLike(requestedManifest)) {
    return holdFromLoader(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      'The handoff manifest must be a local file.',
      { value: String(requestedManifest) }
    );
  }

  let manifestPath;
  try {
    manifestPath = isLocalFile(requestedManifest, 'handoff manifest');
  } catch (error) {
    return holdFromLoader(error.code, error.message, error.details);
  }

  const manifestRoot = options.allowedRoot
    ? path.resolve(options.allowedRoot)
    : path.dirname(manifestPath);

  let manifest;
  try {
    manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')
    );
  } catch (error) {
    return holdFromLoader(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      'The handoff manifest is not valid JSON.',
      { path: manifestPath, cause: error.message }
    );
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    return holdFromLoader(
      'SXE_EXTERNAL_MANIFEST_INVALID',
      'The handoff manifest must declare files[].'
    );
  }

  const seenRoles = new Set();
  const seenCanonicalPaths = new Set();
  let verifiedFiles;

  try {
    verifiedFiles = manifest.files.map((entry) => {
      const role = String(entry?.role || '').trim();
      if (!role || !entry.path || !entry.sha256) {
        throw loaderError(
          'SXE_EXTERNAL_MANIFEST_INVALID',
          'Every handoff file declaration requires role, path, and sha256.'
        );
      }

      if (seenRoles.has(role)) {
        throw loaderError(
          'SXE_EXTERNAL_MANIFEST_INVALID',
          `Duplicate manifest file role: ${role}.`
        );
      }
      seenRoles.add(role);

      const filePath = resolveContainedPath(manifestRoot, entry.path, role);

      if (role === CANONICAL_ROLE) {
        if (seenCanonicalPaths.has(filePath)) {
          throw loaderError(
            'SXE_EXTERNAL_MANIFEST_INVALID',
            'Duplicate canonical Scout FIP file entries are not allowed.'
          );
        }
        seenCanonicalPaths.add(filePath);
      }

      const verified = parseJsonAfterHash(filePath, entry.sha256, role);
      return {
        role,
        path: filePath,
        bytes: verified.bytes,
        actualHash: verified.actualHash,
        parsed: verified.parsed
      };
    });

    assertFixtureConsistency(manifest, verifiedFiles);
  } catch (error) {
    return holdFromLoader(error.code, error.message, error.details);
  }

  const selected = verifiedFiles.find((file) => file.role === CANONICAL_ROLE);
  if (!selected) {
    const internal = verifiedFiles.find((file) => file.role === INTERNAL_ROLE);
    const dto = verifiedFiles.find((file) => file.role === DTO_ROLE);
    return holdFromLoader(
      'SXE_CANONICAL_SCOUT_FIP_MISSING',
      'The handoff manifest does not declare a CANONICAL_SCOUT_FIP.',
      {
        declared_roles: verifiedFiles.map((file) => file.role),
        rejected_roles: [INTERNAL_ROLE, DTO_ROLE],
        internal_missing_fields: internal
          ? missingCanonicalFields(internal.parsed)
          : null,
        dto_missing_fields: dto
          ? missingCanonicalFields(dto.parsed)
          : null
      }
    );
  }

  const missingFields = missingCanonicalFields(selected.parsed);
  if (missingFields.length > 0) {
    return holdFromLoader(
      'SXE_CANONICAL_IDENTITY_UNRESOLVED',
      'The declared canonical Scout FIP is missing required fields.',
      { missing_fields: missingFields }
    );
  }

  const validation = validateCanonicalScoutFip(selected.parsed, {
    now: clock,
    manifestFixtureId: manifest.fixture?.fixture_id || null
  });

  if (!validation.ok) {
    return holdFromLoader(validation.code, validation.message, validation.details);
  }

  const canonicalFip = freezeDeep(selected.parsed);

  return {
    result: 'READY',
    code: 'SXE_EXTERNAL_SCOUT_FIP_READY',
    canonical_fip: canonicalFip,
    verification: {
      exact_byte_sha256: selected.actualHash,
      canonical_validation_hash: validation.verification.canonical_validation_hash,
      scout_tip: SCOUT_PUBLISHED_TIP,
      schema_version: validation.verification.schema_version,
      sport: validation.verification.sport,
      kickoff_utc: validation.verification.kickoff_utc
    },
    metadata: Object.freeze({
      manifest_path: manifestPath,
      manifest_version: manifest.manifest_version || null,
      project_id: manifest.project_id || null,
      selected_role: CANONICAL_ROLE
    })
  };
}

function loadVerifiedExternalFip(options = {}) {
  const loaded = loadExternalScoutFip(options);
  if (loaded.result !== 'READY') {
    throw loaderError(loaded.code, loaded.message, loaded.details);
  }

  return Object.freeze({
    canonicalFip: loaded.canonical_fip,
    metadata: loaded.metadata
  });
}

function parseCli(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--manifest');
  if (index === -1) {
    return {};
  }

  return { manifestPath: argv[index + 1] };
}

if (require.main === module) {
  const loaded = loadExternalScoutFip(parseCli());
  if (loaded.result === 'READY') {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      result: loaded.result,
      code: loaded.code,
      verification: loaded.verification
    })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      result: loaded.result,
      code: loaded.code,
      message: loaded.message,
      details: loaded.details || null
    })}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CANONICAL_ROLE,
  INTERNAL_ROLE,
  DTO_ROLE,
  REQUIRED_CANONICAL_PATHS: REQUIRED_FIELD_PATHS,
  loadExternalScoutFip,
  loadVerifiedExternalFip,
  missingCanonicalFields,
  parseCli,
  sha256: sha256Upper
};
