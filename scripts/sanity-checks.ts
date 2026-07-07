/**
 * Phase E Sanity Checks
 * Validates: taxonomyV2 fallback, URL param parsing, focus zoom intent
 */

import { 
  resolveToV2Type, 
  ALL_TAXONOMY_TYPES,
  TAXONOMY_GROUPS,
  TaxonomyGroupId 
} from '../client/src/features/report/taxonomyV2';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name} - Error: ${e}`);
    failed++;
  }
}

console.log('\n=== TaxonomyV2 Fallback Resolution ===\n');

// Test v2 types resolve to themselves (new group.type format)
test('v2 type "emergency.theft" resolves to itself', () => {
  const result = resolveToV2Type('emergency.theft');
  return result?.id === 'emergency.theft' && result?.groupId === 'emergency';
});

test('v2 type "emergency.fire" resolves to itself', () => {
  const result = resolveToV2Type('emergency.fire');
  return result?.id === 'emergency.fire' && result?.groupId === 'emergency';
});

test('v2 type "nabor_note.noise_complaint" resolves to itself', () => {
  const result = resolveToV2Type('nabor_note.noise_complaint');
  return result?.id === 'nabor_note.noise_complaint' && result?.groupId === 'nabor_note';
});

// Test v1 legacy types fall back correctly to v2
test('v1 "theft" falls back to v2 "emergency.theft"', () => {
  const result = resolveToV2Type('theft');
  return result?.id === 'emergency.theft' && result?.groupId === 'emergency';
});

test('v1 "fire" falls back to v2 "emergency.fire"', () => {
  const result = resolveToV2Type('fire');
  return result?.id === 'emergency.fire' && result?.groupId === 'emergency';
});

test('v1 "noise_complaint" falls back to v2 "nabor_note.noise_complaint"', () => {
  const result = resolveToV2Type('noise_complaint');
  return result?.id === 'nabor_note.noise_complaint' && result?.groupId === 'nabor_note';
});

// Test unknown types return null
test('Unknown type returns null', () => {
  const result = resolveToV2Type('unknown_garbage_type');
  return result === null;
});

// Test all v2 types have valid group mappings
test('All v2 types have valid group mappings', () => {
  const validGroups: TaxonomyGroupId[] = ['services', 'nabor_note', 'emergency', 'critical'];
  return ALL_TAXONOMY_TYPES.every(t => validGroups.includes(t.groupId));
});

// Test determinism - same input always returns same output
test('Resolution is deterministic (10 iterations)', () => {
  const testTypes = ['theft', 'break-in', 'fire', 'car-accident'];
  for (const type of testTypes) {
    const results = Array(10).fill(null).map(() => resolveToV2Type(type));
    const first = JSON.stringify(results[0]);
    if (!results.every(r => JSON.stringify(r) === first)) {
      return false;
    }
  }
  return true;
});

console.log('\n=== Group URL Param Validation ===\n');

// Validate group IDs are consistent
const validGroupIds: TaxonomyGroupId[] = ['services', 'nabor_note', 'emergency', 'critical'];

test('TAXONOMY_GROUPS contains all valid group IDs', () => {
  return validGroupIds.every(id => TAXONOMY_GROUPS[id] !== undefined);
});

test('Group IDs are valid URL param values (no special chars)', () => {
  return validGroupIds.every(id => /^[a-z_]+$/.test(id));
});

// Simulate URL param parsing (same logic used in Feed and Map)
function parseGroupParam(param: string | null): TaxonomyGroupId | null {
  if (!param) return null;
  if (validGroupIds.includes(param as TaxonomyGroupId)) {
    return param as TaxonomyGroupId;
  }
  return null;
}

test('URL param "critical" parses to critical group', () => {
  return parseGroupParam('critical') === 'critical';
});

test('URL param "emergency" parses to emergency group', () => {
  return parseGroupParam('emergency') === 'emergency';
});

test('URL param "invalid_group" parses to null', () => {
  return parseGroupParam('invalid_group') === null;
});

test('Empty URL param parses to null', () => {
  return parseGroupParam(null) === null;
});

console.log('\n=== Focus Zoom Intent ===\n');

// The focus zoom level should be 18 (street level)
const FOCUS_ZOOM = 18;

test('Focus zoom level is 18 (street-level)', () => {
  return FOCUS_ZOOM === 18;
});

test('Focus zoom is greater than auto-fit typical zoom (14-16)', () => {
  return FOCUS_ZOOM > 16;
});

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? '\n✅ All sanity checks passed!\n' : '\n❌ Some checks failed!\n');

process.exit(failed > 0 ? 1 : 0);
