import { createHash } from 'node:crypto';

export const actions = ['create', 'sync', 'withdraw', 'status.observe', 'effect.reconcile', 'interaction.observe'].map(x => `channel-publication.${x}`);
const assert = (condition, reason) => { if (!condition) throw new Error(reason); };
const text = x => typeof x === 'string' && x.trim().length > 0;
export const digest = x => createHash('sha256').update(JSON.stringify(sort(x))).digest('hex');
function sort(x) { return Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sort(x[k])])) : x; }
export function emptyState(org) {
  assert(text(org), 'organization required');
  return { org, revision: 0, publications: {}, effects: {}, observations: [], interactions: [] };
}

// Pure transition: the caller owns atomic compare-and-swap persistence and trusted
// source/authority resolution. This module never contacts a portal or person.
export function transition(state, command, context) {
  const { action, publicationId, payload, operationId, expectedRevision } = command;
  assert(actions.includes(action), 'unsupported action');
  assert(state.org === context.org && command.org === state.org, 'organization scope denied');
  assert(context.authorizedActions?.includes(action), 'action grant denied');
  assert(text(publicationId) && text(operationId), 'stable identity required');
  assert(payload && typeof payload === 'object', 'payload required');
  assert(expectedRevision === state.revision, 'revision conflict');
  assert(text(context.sourceMapRevision) && text(context.policyRevision) && text(context.principal), 'trusted policy/source context required');
  assert(Number.isFinite(Date.parse(context.now)), 'trusted clock required');
  const active = x => x && x.revoked === false && x.active === true && Date.parse(x.validFrom) <= Date.parse(context.now) && Date.parse(context.now) < Date.parse(x.validUntil);
  const grant = context.grant;
  assert(active(grant) && grant.org === state.org && grant.principal === context.principal && grant.publicationId === publicationId && grant.purpose === 'public-listing-distribution' && grant.actions?.includes(action), 'current exact target grant denied');
  assert(context.hold === false, 'scope hold proof required');
  assert(context.department !== 'supply-acquisition' || action === 'channel-publication.status.observe', 'Supply Acquisition status read only');
  assert(action === 'channel-publication.status.observe' || context.department === 'marketing', 'Marketing owns publication effects and channel interaction normalization');
  const source = context.sourceBinding;
  assert(active(source) && source.conflict === false && source.hold === false && source.org === state.org && source.publicationId === publicationId && source.mapRevision === context.sourceMapRevision && text(source.channelAccountRef), 'current conflict-free unheld scoped Source Authority rule required');
  assert(source.channelAccountRef === (payload.channelAccountRef ?? state.publications[publicationId]?.channelAccountRef), 'Source Authority channel mismatch');
  const mutates = ['channel-publication.create', 'channel-publication.sync', 'channel-publication.withdraw'].includes(action);
  const existing = state.publications[publicationId];
  const copy = structuredClone(state);
  const requestDigest = digest({ org: state.org, action, publicationId, payload });
  if (mutates) {
    assert(context.department === 'marketing', 'Marketing executor required');
    assert(context.emergencyStop === false, 'emergency stop proof required');
    const approval = context.approval;
    assert(approval && text(approval.id) && text(approval.principal) && text(approval.authorityEvidenceRef) && approval.competent === true && approval.revoked === false && approval.principal !== context.principal, 'competent independent approval required');
    assert(approval.action === action && approval.org === state.org && approval.publicationId === publicationId && approval.payloadDigest === requestDigest, 'approval binding mismatch');
    assert(approval.policyRevision === context.policyRevision && approval.sourceMapRevision === context.sourceMapRevision, 'approval revision stale');
    assert(Date.parse(approval.validFrom) <= Date.parse(context.now) && Date.parse(context.now) < Date.parse(approval.validUntil), 'approval expired/not active');
    const previous = state.effects[operationId];
    if (previous) {
      assert(previous.requestDigest === requestDigest, 'operation identity reused with different payload');
      assert(previous.status !== 'UNKNOWN', 'reconcile before retry');
      return { state: copy, result: { status: 'DEDUPLICATED', effect: structuredClone(previous) } };
    }
    assert(!Object.values(state.effects).some(e => e.publicationId === publicationId && e.status === 'UNKNOWN'), 'pending unknown effect blocks competing mutation');
    if (action === 'channel-publication.create') assert(!existing, 'publication already exists');
    else assert(existing, 'publication missing');
    assert(text(payload.channelAccountRef) && (!existing || existing.channelAccountRef === payload.channelAccountRef), 'channel account mismatch');
    if (action !== 'channel-publication.withdraw') {
      const accepted = context.listingVersion;
      assert(accepted && accepted.org === state.org && accepted.source === 'woia-re-property-data' && accepted.accepted === true && accepted.current === true, 'accepted current ListingVersion required');
      assert(accepted.id === payload.listingVersionRef && accepted.digest === payload.listingDigest, 'ListingVersion binding mismatch');
      assert(accepted.mandateActive === true && accepted.rightsAccepted === true && accepted.mediaRightsAccepted === true, 'Mandate/rights/media not accepted');
      assert(accepted.mediaDigest === payload.mediaDigest, 'media version changed');
    }
    const desired = action === 'channel-publication.withdraw' ? 'WITHDRAWN' : 'PUBLISHED';
    copy.publications[publicationId] = { ...(existing ?? {}), org: state.org, id: publicationId, channelAccountRef: payload.channelAccountRef, listingVersionRef: payload.listingVersionRef ?? existing?.listingVersionRef, desired, observed: existing?.observed ?? 'UNKNOWN' };
    copy.effects[operationId] = { org: state.org, operationId, publicationId, action, requestDigest, status: 'UNKNOWN', approvalRef: approval.id, payload: structuredClone(payload) };
    copy.revision++;
    return { state: copy, result: { status: 'EFFECT_INTENT_PREPARED', effect: structuredClone(copy.effects[operationId]), dispatchPerformed: false } };
  }
  assert(existing, 'publication missing');
  assert(['marketing', 'supply-acquisition', 'customer-service'].includes(context.department), 'consumer scope denied');
  assert(context.authoritativeChannelAccountRef === existing.channelAccountRef, 'remote source binding mismatch');
  assert(text(payload.evidenceRef) && text(payload.sourceRevision), 'immutable remote evidence required');
  const priorObservation = state.observations.find(o => o.operationId === operationId);
  if (priorObservation) {
    assert(priorObservation.requestDigest === requestDigest, 'observation identity conflict');
    return { state: copy, result: { status: 'DEDUPLICATED', observation: structuredClone(priorObservation) } };
  }
  if (action === 'channel-publication.interaction.observe') {
    assert(text(payload.interactionId) && text(payload.senderRef) && text(payload.contentRef), 'inbound interaction references required');
    const prior = state.interactions.find(i => i.interactionId === payload.interactionId);
    if (prior) { assert(prior.digest === digest(payload), 'interaction identity conflict'); return { state: copy, result: { status: 'DEDUPLICATED', interaction: prior } }; }
    const interaction = { ...structuredClone(payload), org: state.org, publicationId, digest: digest(payload), route: { provider: 'woia-communications', department: 'customer-service', action: 'communication.external.receive' }, dispatchPerformed: false };
    copy.interactions.push(interaction);
    copy.revision++;
    return { state: copy, result: { status: 'INBOUND_INTERACTION_NORMALIZED', interaction } };
  }
  assert(['PUBLISHED', 'WITHDRAWN', 'UNKNOWN'].includes(payload.remoteState), 'remote state invalid');
  const fresh = Number.isFinite(Date.parse(payload.observedAt)) && Date.parse(payload.observedAt) <= Date.parse(context.now) && Date.parse(context.now) < Date.parse(payload.freshUntil);
  const observed = fresh ? payload.remoteState : 'UNKNOWN';
  if (action === 'channel-publication.effect.reconcile') {
    const effect = state.effects[payload.effectOperationId];
    assert(effect && effect.publicationId === publicationId && effect.requestDigest === payload.requestDigest, 'reconciliation identity mismatch');
    assert(['CONFIRMED', 'NOT_APPLIED', 'UNKNOWN'].includes(payload.outcome), 'outcome invalid');
    const terminal = fresh && payload.outcome !== 'UNKNOWN';
    if (terminal && payload.outcome === 'CONFIRMED') assert(observed === (effect.action === 'channel-publication.withdraw' ? 'WITHDRAWN' : 'PUBLISHED'), 'confirmed outcome contradicts exact effect');
    if (effect.status !== 'UNKNOWN') assert(effect.status === payload.outcome && terminal, 'terminal evidence cannot be overwritten');
    copy.effects[payload.effectOperationId] = { ...effect, status: terminal ? payload.outcome : 'UNKNOWN', reconciliationEvidenceRef: payload.evidenceRef };
  }
  copy.observations.push({ ...structuredClone(payload), org: state.org, publicationId, operationId, requestDigest, observed });
  copy.publications[publicationId].observed = observed;
  copy.revision++;
  return { state: copy, result: { status: observed, canonicalListingChanged: false } };
}
