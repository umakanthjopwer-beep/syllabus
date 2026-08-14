import assert from 'node:assert/strict';
import { workbookObjectFromXlsx, EXPECTED_SHEETS } from './xlsx-onboarding-adapter.mjs';
const fake={
  read(){return {Sheets:Object.fromEntries(EXPECTED_SHEETS.map(n=>[n,{name:n}]))}},
  utils:{sheet_to_json(sheet){return [{Sheet:sheet.name}]}}
};
const out=workbookObjectFromXlsx(fake,new ArrayBuffer(0));
assert.deepEqual(Object.keys(out),EXPECTED_SHEETS);
assert.equal(out.Branch[0].Sheet,'Branch');
const missing={read(){return {Sheets:{Branch:{}}}},utils:fake.utils};
assert.throws(()=>workbookObjectFromXlsx(missing,new ArrayBuffer(0)),/Missing required sheet/);
console.log('PASS: XLSX onboarding adapter (3/3 checks)');
