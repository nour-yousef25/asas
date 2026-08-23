import { randomUUID } from 'node:crypto';

export const REQUIRED_EVIDENCE_FIELDS = ['id', 'purpose', 'setup', 'command', 'inputClass', 'expected', 'actual', 'databaseIdentity', 'tenant', 'organization', 'membershipId', 'leaseId', 'tenantRoleId', 'correlationId', 'timestamp', 'result', 'failureReason', 'assertionPassed', 'evidenceRef'];

const RECORDER_FAULT_CODES = new Set(['EVIDENCE_OUTPUT_UNDEFINED', 'REFERENCE_ERROR', 'EVIDENCE_EVALUATOR_EXCEPTION', 'EVIDENCE_METADATA_EXCEPTION']);

function errorCode(error) {
  if (error?.code) return error.code;
  if (error?.name === 'ReferenceError') return 'REFERENCE_ERROR';
  return 'UNEXPECTED';
}

function serializeActual(output, error) {
  if (error) return `${RECORDER_FAULT_CODES.has(errorCode(error)) ? 'ERROR' : 'DENY'}:${errorCode(error)}`;
  return typeof output === 'object' ? JSON.stringify(output) : String(output);
}

function deriveMetadata(output, correlationId, metadata) {
  try {
    const supplied = typeof metadata === 'function' ? metadata({ output, correlationId }) : (metadata ?? {});
    return {
      databaseIdentity: supplied.databaseIdentity ?? output?.databaseIdentity ?? output?.sessionUser ?? 'none',
      tenant: supplied.tenant ?? output?.tenant ?? output?.organizationId ?? 'none',
      organization: supplied.organization ?? output?.organizationId ?? null,
      membershipId: supplied.membershipId ?? output?.membershipId ?? null,
      leaseId: supplied.leaseId ?? output?.leaseId ?? null,
      tenantRoleId: supplied.tenantRoleId ?? output?.tenantRoleId ?? output?.sessionUser ?? null,
    };
  } catch (error) {
    return { metadataError: error, databaseIdentity: 'none', tenant: 'none', organization: null, membershipId: null, leaseId: null, tenantRoleId: null };
  }
}

function finalizeEvidence({ id, purpose, setup, command, inputClass, expected, evaluate, metadata, correlationId }, output, executionError) {
  const resolvedCorrelationId = correlationId ?? randomUUID();
  let evaluatorError = null;
  let assertionPassed = false;
  const normalizedCode = executionError ? errorCode(executionError) : null;
  if (!executionError || !RECORDER_FAULT_CODES.has(normalizedCode)) {
    try {
      assertionPassed = evaluate({ output, error: executionError }) === true;
    } catch (error) {
      evaluatorError = error;
      assertionPassed = false;
    }
  }
  const resolvedMetadata = deriveMetadata(output, resolvedCorrelationId, metadata);
  const metadataError = resolvedMetadata.metadataError;
  const recorderFault = executionError && RECORDER_FAULT_CODES.has(normalizedCode) ? executionError : null;
  const blockingFault = recorderFault ?? evaluatorError ?? metadataError;
  const safeAssertion = assertionPassed && !blockingFault;
  const failureCode = safeAssertion ? null : errorCode(blockingFault ?? executionError ?? new Error('EXPECTED_ACTUAL_MISMATCH'));
  return {
    id,
    purpose,
    setup,
    command,
    inputClass,
    expected,
    actual: serializeActual(output, executionError ?? evaluatorError ?? metadataError),
    databaseIdentity: resolvedMetadata.databaseIdentity,
    tenant: resolvedMetadata.tenant,
    organization: resolvedMetadata.organization,
    membershipId: resolvedMetadata.membershipId,
    leaseId: resolvedMetadata.leaseId,
    tenantRoleId: resolvedMetadata.tenantRoleId,
    correlationId: resolvedCorrelationId,
    timestamp: new Date().toISOString(),
    result: safeAssertion ? 'PASS' : 'FAIL',
    failureReason: safeAssertion ? null : failureCode,
    assertionPassed: safeAssertion,
    evidenceRef: `${id}:${resolvedCorrelationId}`,
  };
}

export function recordEvidence(options) {
  const correlationId = options.correlationId ?? randomUUID();
  let output = null;
  let executionError = null;
  try {
    output = options.execute(correlationId);
    if (typeof output === 'undefined') {
      const error = new Error('Evidence command returned undefined output');
      error.code = 'EVIDENCE_OUTPUT_UNDEFINED';
      throw error;
    }
  } catch (error) {
    executionError = error;
  }
  return finalizeEvidence({ ...options, correlationId }, output, executionError);
}

export async function recordEvidenceAsync(options) {
  const correlationId = options.correlationId ?? randomUUID();
  let output = null;
  let executionError = null;
  try {
    output = await options.execute(correlationId);
    if (typeof output === 'undefined') {
      const error = new Error('Evidence command returned undefined output');
      error.code = 'EVIDENCE_OUTPUT_UNDEFINED';
      throw error;
    }
  } catch (error) {
    executionError = error;
  }
  return finalizeEvidence({ ...options, correlationId }, output, executionError);
}
