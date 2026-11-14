// node --test test/*.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { judge, prepareBanners } from '../src/renderer/judge.js'
import { pityModel } from '../src/renderer/analysis.js'
import { fiftyLuck, bannerEfficiency, expectedUpAverage, upCosts } from '../src/renderer/luck.js'

const B = (id, version, phase, gachaType, up5, start, end, extra = {}) => ({
  id, version, phase, gachaType, channel: gachaType === '3' || gachaType === '103' ? 'engine' : 'character',
  rerun: gachaType.length === 3, title: `t${id}`, up5, names: {},
  start, startLocal: ['12:00:00', '11:59:59', '14:59:59'].includes(start.slice(11)),
  end, endLocal: ['12:00:00', '11:59:59', '14:59:59'].includes(end.slice(11)), ...extra,
})
const data = {
  banners: [
    // 1.0: two agent banners at once (version launch 11:00 UTC+8), second half from 12:00 server time
    B(0, '1.0', '上半', '2', ['1191'], '2024-07-04 11:00:00', '2024-07-24 11:59:59'),
    B(1, '1.0', '上半', '2', ['1181'], '2024-07-04 11:00:00', '2024-07-24 11:59:59'),
    B(2, '1.0', '下半', '2', ['1211'], '2024-07-24 12:00:00', '2024-08-14 14:59:59'),
    // 1.1 launch
    B(3, '1.1', '上半', '2', ['1241'], '2024-08-15 11:00:00', '2024-09-04 11:59:59'),
    B(4, '1.0', '上半', '3', ['14119'], '2024-07-04 11:00:00', '2024-07-24 11:59:59'),
    B(5, '2.5', '下半', '102', ['1191', '1181'], '2026-01-21 12:00:00', '2026-02-05 14:59:59'),
  ],
}
let seq = 1000
const rec = (gt, item, name, time, rank = 4) => ({ id: String(seq++), item_id: item, item_type: '代理人', name, rank_type: String(rank), time, gacha_id: '0', gacha_type: gt })
const filler = (n, gt, time) => Array.from({ length: n }, () => rec(gt, '12001', 'B', time, 2))

test('concurrent agent banners: either rate-up is a win; the guarantee carries across periods', () => {
  const r = new Map([['2', [
    ...filler(9, '2', '2024-07-05 10:00:00'), rec('2', '1181', '格莉丝', '2024-07-05 10:00:00'),   // 2nd banner's rate-up: win
    rec('2', '1021', '猫又', '2024-07-06 10:00:00'),                                               // lose
    rec('2', '1211', '朱鸢', '2024-07-25 10:00:00'),                                               // guaranteed, second half
  ]]])
  const { pools, issues } = judge(r, data, { tz: 8 })
  const f = pools['2'].fives
  assert.deepEqual(f.map(x => [x.result, x.pity]), [['win', 10], ['lose', 1], ['guaranteed', 1]])
  assert.equal(f[0].bannerKey, '0+1')
  assert.equal(f[0].banner.label, '1.0 上半')
  assert.equal(f[1].guaranteeTo.key, '2')
  assert.equal(issues.length, 0)
})

test('America server: second-half start is server-local, version launch is UTC+8 and opens early', () => {
  const tz = -5
  const w = prepareBanners(data, tz)['2']
  // 12:00 server time, not converted
  assert.equal(new Date(w.find(b => b.id === 2).s).toISOString(), '2024-07-24T12:00:00.000Z')
  // 1.1 launch: extended back to the end of 1.0 (14:59:59 server time) + 1 s
  assert.equal(new Date(w.find(b => b.id === 3).s).toISOString(), '2024-08-14T15:00:00.000Z')
  // a pull at 21:30 server time on launch day (10:30 UTC+8, before the published 11:00) matches 1.1
  const r = new Map([['2', [rec('2', '1241', '青衣', '2024-08-14 21:30:00')]]])
  assert.equal(judge(r, data, { tz }).pools['2'].fives[0].result, 'win')
})

test('reruns: the first S-rank of a period is the chosen rate-up (welfare), then normal 50/50s', () => {
  const r = new Map([['102', [
    rec('102', '1181', '格莉丝', '2026-01-22 10:00:00'),   // welfare guarantee
    rec('102', '1021', '猫又', '2026-01-23 10:00:00'),     // a normal 50/50, lost
  ]]])
  const f = judge(r, data, { tz: 8 }).pools['102'].fives
  assert.deepEqual(f.map(x => [x.result, x.note]), [['guaranteed', 'welfare'], ['lose', undefined]])
})

test('W-Engines 75/25 then guaranteed; Bangboo and standard have no verdict; unmatched time is reported', () => {
  const r = new Map([
    ['3', [rec('3', '14102', '钢铁肉垫', '2024-07-05 10:00:00'), rec('3', '14119', '深海访客', '2024-07-05 11:00:00')]],
    ['5', [rec('5', '54001', '鲨牙布', '2024-07-05 10:00:00')]],
    ['2', [rec('2', '1191', '艾莲', '2023-01-01 00:00:00')]],
  ])
  const { pools, issues } = judge(r, data, { tz: 8 })
  assert.deepEqual(pools['3'].fives.map(x => x.result), ['off', 'up_guaranteed'])
  assert.equal(pools['5'].fives[0].result, 'standard')
  assert.equal(pools['2'].fives[0].result, 'unknown')
  assert.equal(issues.length, 1)
})

test('models match the published consolidated rates', () => {
  assert.ok(Math.abs(100 / pityModel('character').mean - 1.6) < 0.01)
  assert.ok(Math.abs(100 / pityModel('engine').mean - 2.0) < 0.01)
  assert.ok(Math.abs(expectedUpAverage('engine').post - 1.25 * pityModel('engine').mean) < 1e-9)
  const f = fiftyLuck([{ result: 'up' }, { result: 'off' }, { result: 'up_guaranteed' }], 'engine')
  assert.deepEqual([f.w, f.n], [1, 2])
  const fives = [{ pity: 70, result: 'lose', time: '2024' }, { pity: 75, result: 'guaranteed', time: '2024' }]
  assert.deepEqual(upCosts(fives).costs.map(c => c.cost), [145])
  assert.ok(bannerEfficiency('character', fives).top > 0.5)
})
