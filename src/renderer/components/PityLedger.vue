<template>
  <section class="panel">
    <div class="head">
      <div>
        <h2>{{ text.ledger.title }}</h2>
        <p class="sub">{{ text.ledger.hint }}</p>
      </div>
      <el-radio-group v-model="pool" size="small">
        <el-radio-button v-for="k of pools" :key="k" :label="k">{{ typeMap.get(k) || k }}</el-radio-button>
        <el-radio-button v-if="analysis.collection?.length" label="collection">{{ text.collection.tab }}</el-radio-button>
      </el-radio-group>
    </div>
    <collection-grid v-if="pool === 'collection'" :items="analysis.collection" :characters="analysis.characters" :icons="icons" :text="text"
                     @set-extra="(id, n) => emit('set-extra', id, n)"></collection-grid>
    <template v-else>
    <div class="legend">
      <span v-for="[cls, label] of legend" :key="cls"><i class="dot" :class="cls"></i>{{ label }}</span>
    </div>
    <div class="scale" aria-hidden="true">
      <span class="c-date"></span><span></span>
      <span class="axis">
        <span v-for="t of ticks" :key="t" :style="{ left: `${((t - 0.5) / model.cap) * 100}%` }">{{ t }}{{ t === model.soft ? ` ${text.ledger.softPity}` : '' }}</span>
      </span>
      <span></span><span></span>
    </div>
    <div ref="scroller" class="ledger" @pointermove="move" @pointerleave="hide" @scroll.passive="hide">
      <p v-if="!groups.length" class="sub" style="padding: 16px 0">{{ text.ledger.empty }}</p>
      <template v-for="g of groups" :key="g.key">
        <div class="ghead">
          <template v-if="noRateUp"><span class="t">{{ g.items[0].time.slice(0, 7) }}</span></template>
          <template v-else>
            <span class="v">{{ g.items[0].banner?.label }}</span>
            <span class="t">{{ text.ledger.upLabel }} {{ (g.items[0].up || []).join(' / ') }}</span>
          </template>
          <span class="d">{{ g.range }} · {{ fmt(text.ledger.count, { n: g.items.length }) }}</span>
          <span v-if="g.luck" class="lk" :title="g.luckTip">
            <i :style="{ background: TIER_COLORS[g.luck.tier] }"></i>{{ text.fortune.effShort }} {{ text.tier[g.luck.tier] }} · {{ topText(g.luck.top, text) }}
          </span>

        </div>
        <div v-for="f of g.items" :key="f.id || f.time + f.name" class="row" tabindex="0" :data-id="f.id"
             @focus="focusTip($event, f)" @blur="hide">
          <span class="date">{{ f.time.slice(0, 10) }}</span>
          <span class="name">
            <img v-if="icons[f.itemId]" class="av" :src="icons[f.itemId]" alt="">
            <span v-else class="av"></span>
            <span class="nm">{{ f.name }}</span>
          </span>
          <span class="track">
            <i :class="info(f)[1]" :style="{ width: `${Math.min(1, f.pity / model.cap) * 100}%` }"></i>
            <b :style="{ left: `${((model.soft - 1) / model.cap) * 100}%` }"></b>
          </span>
          <span class="p">{{ f.pity }}</span>
          <span class="res">
            <span class="pill"><i class="dot" :class="info(f)[1]"></i>{{ info(f)[0] }}</span>
            <span v-if="crossOut(f)" class="cross">{{ fmt(text.ledger.guarOut, { up: upOf(crossOut(f)) }) }}</span>
            <span v-if="crossIn(f)" class="cross">{{ fmt(text.ledger.guarIn, { up: upOf(crossIn(f)) }) }}</span>
            <span v-if="fullCost.has(f.id)" class="full" :title="fmt(text.ledger.fullPityTip, { n: fullCost.get(f.id) })">{{ fmt(text.ledger.fullPity, { n: fullCost.get(f.id) }) }}</span>
          </span>

        </div>
      </template>
    </div>
    </template>
    <div v-show="tip" ref="tipEl" class="tip" v-html="tip"></div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import CollectionGrid from './CollectionGrid.vue'
import { fmt, resultInfo, legendFor, POOL_ORDER, esc, topText, TIER_COLORS } from '../analysisUi'
import { bannerSpeed, bannerEfficiency, fiftyLuck, upCosts, tierOf, FULL_PITY } from '../luck.js'
import { pityModel, RADIANCE_SINCE } from '../analysis'

const props = defineProps({ analysis: Object, typeMap: Map, text: Object, icons: Object })
const emit = defineEmits(['set-extra'])

const pools = computed(() => POOL_ORDER.filter(k => props.analysis.pools[k]?.total))
const pool = ref('2')
watch(pools, ps => { if (!ps.includes(pool.value) && pool.value !== 'collection') pool.value = ps[0] }, { immediate: true })
const scroller = ref(null)
watch(pool, () => { if (scroller.value) scroller.value.scrollTop = 0 })

const kind = computed(() => props.analysis.pools[pool.value]?.kind || 'character')
const model = computed(() => pityModel(kind.value))
const ticks = computed(() => (model.value.cap === 80 ? [1, 20, 40, model.value.soft, 80] : [1, 30, 60, 74, 90]))
const legend = computed(() => legendFor(kind.value, props.text))
// rate-up 5★ that came after FULL_PITY+ pulls (lost near soft pity, then guaranteed near soft pity)
const fullCost = computed(() => {
  const m = new Map()
  const p = props.analysis.pools[pool.value]
  if (!p || kind.value !== 'character') return m
  for (const c of upCosts(p.fives).costs) if (c.cost >= FULL_PITY) m.set(c.f.id, c.cost)
  return m
})
const info = f => resultInfo(f, kind.value, props.text)

// same key the judge puts on each 5★, so a loss and its guarantee can be compared
// standard and Bangboo channels have no rate-up: group those by month
const noRateUp = computed(() => kind.value === 'standard' || kind.value === 'bangboo')
const groupKey = f => (noRateUp.value ? f.time.slice(0, 7) : f.bannerKey || `unknown|${f.time}`)
// the other end of a loss/guarantee pair, when it sits in a different group
const crossOut = f => (f.guaranteeTo && f.guaranteeTo.key !== groupKey(f) ? f.guaranteeTo : null)
const crossIn = f => (f.guaranteeFrom && f.guaranteeFrom.key !== groupKey(f) ? f.guaranteeFrom : null)
const upOf = r => (r.up || []).join(' / ')

const groups = computed(() => {
  const p = props.analysis.pools[pool.value]
  if (!p) return []
  // one group per banner even when pulls alternate between concurrent banners;
  // groups are ordered by their most recent 5★
  const out = [], byKey = new Map()
  for (const f of [...p.fives].reverse()) {
    const key = groupKey(f)
    let g = byKey.get(key)
    if (!g) { g = { key, items: [] }; byKey.set(key, g); out.push(g) }
    g.items.push(f)
  }
  for (const g of out) {
    const a = g.items[g.items.length - 1].time, b = g.items[0].time
    g.range = a.slice(0, 10) === b.slice(0, 10) ? a.slice(5, 10) : `${a.slice(5, 10)} – ${b.slice(5, 10)}`
    // this banner's pulls per rate-up (carried-over pity included); speed and 50/50 in the tooltip
    if (!noRateUp.value && g.items[0].banner) {
      const chrono = [...g.items].reverse()
      const eff = bannerEfficiency(kind.value, chrono)
      if (eff) {
        const t = props.text.fortune, tier = r => `${props.text.tier[tierOf(r.top)]} ${topText(r.top, props.text)}`
        const sp = bannerSpeed(kind.value, chrono), fi = fiftyLuck(chrono, kind.value)
        g.luck = { ...eff, tier: tierOf(eff.top) }
        g.luckTip = [
          fmt(t.bannerEff, { u: eff.U, t: eff.T, v: tier(eff) }),
          fmt(t.bannerSpeed, { n: sp.N, t: sp.S, v: tier(sp) }),
          fi.n ? fmt(t.bannerFifty, { n: fi.n, w: fi.w, v: tier(fi) }) : null,
        ].filter(Boolean).join('\n')
      }
    }
  }
  return out
})

// tooltip
const tip = ref('')
const tipEl = ref(null)
const byId = computed(() => new Map((props.analysis.pools[pool.value]?.fives || []).map(f => [f.id, f])))
function tipHtml(f) {
  const t = props.text.ledger
  const icon = props.icons[f.itemId] ? `<img src="${props.icons[f.itemId]}" alt="">` : ''
  let h = `<div class="th">${icon}<div><b>${esc(f.name)} · ${fmt(t.pull, { n: f.pity })}</b><div class="m">${esc(f.time)}${f.banner?.name ? ' · ' + esc(f.banner.name) : ''}</div></div></div>`
  if (f.up?.length) h += `<div>${esc(fmt(t.currentUp, { v: f.up.join(' / ') }))}</div>`
  h += `<div>${esc(fmt(t.verdict, { v: info(f)[0] }))}</div>`
  if (f.streakBefore !== undefined && f.time >= RADIANCE_SINCE) h += `<div class="m">${esc(fmt(t.streak, { n: f.streakBefore }))}</div>`
  const t2 = props.text.ledger
  if (f.guaranteeTo) h += `<div>${esc(fmt(t2.guarOutTip, { up: upOf(f.guaranteeTo), name: f.guaranteeTo.name, d: f.guaranteeTo.time.slice(0, 10) }))}</div>`
  else if (f.result === 'lose' || f.result === 'off') h += `<div>${esc(t2.guarPendingTip)}</div>`
  if (f.guaranteeFrom) h += `<div>${esc(fmt(t2.guarInTip, { up: upOf(f.guaranteeFrom), name: f.guaranteeFrom.name, d: f.guaranteeFrom.time.slice(0, 10) }))}</div>`
  if (f.note) h += `<div class="m">${esc(f.note)}</div>`

  return h
}
function place(x, y) {
  const el = tipEl.value
  if (!el) return
  const r = el.getBoundingClientRect(), pad = 12
  let left = x + 14, top = y + 14
  if (left + r.width > innerWidth - pad) left = x - r.width - 14
  if (top + r.height > innerHeight - pad) top = y - r.height - 14
  el.style.left = `${Math.max(pad, left)}px`
  el.style.top = `${Math.max(pad, top)}px`
}
function move(e) {
  const row = e.target.closest?.('.row')
  const f = row && byId.value.get(row.dataset.id)
  if (!f) return hide()
  tip.value = tipHtml(f)
  requestAnimationFrame(() => place(e.clientX, e.clientY))
}
function focusTip(e, f) {
  tip.value = tipHtml(f)
  const b = e.target.getBoundingClientRect()
  requestAnimationFrame(() => place(b.left + b.width / 2, b.bottom))
}
function hide() { tip.value = '' }
</script>

<style scoped>
.panel { position: relative; padding: 16px 18px 0; border: 1px solid #e4e7ed; border-radius: 8px; background: #fff }
.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 10px 16px; margin-bottom: 10px }
h2 { margin: 0; font-size: 16px; font-weight: 600; color: #303133 }
.sub { margin: 2px 0 0; font-size: 12px; color: #909399 }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: #606266; margin-bottom: 8px }
.legend span { display: inline-flex; align-items: center; gap: 6px }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #a3a9b2; flex: none }
.dot.win, .track i.win { background: #1baf7a } .dot.lose, .track i.lose { background: #eb6834 } .dot.guar, .track i.guar { background: #2a78d6 }
/* px, not em: the scale row uses a smaller font and must line up with the bars */
.row, .scale { display: grid; grid-template-columns: 78px 128px minmax(0, 1fr) 30px 150px; gap: 10px; align-items: center }
@media (max-width: 760px) {
  .row, .scale { grid-template-columns: 120px minmax(0, 1fr) 28px 140px }
  .date, .c-date { display: none }
}
/* both reserve a scrollbar gutter so the scale lines up with the scrolling rows */
.scale { padding: 0 4px 6px; font-size: 11px; color: #909399; overflow: hidden; scrollbar-gutter: stable }
.axis { position: relative; height: 1.4em }
.axis span { position: absolute; transform: translateX(-50%); white-space: nowrap }
.ledger { max-height: 560px; overflow-y: auto; margin: 0 -18px; padding: 0 18px 12px; border-top: 1px solid #ebeef5; overscroll-behavior: contain; scrollbar-gutter: stable }
.ghead { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; padding: 10px 0 6px; background: #fff; border-bottom: 1px solid #ebeef5 }
.ghead .v { min-width: 2.6em; font-weight: 600; font-size: 12px; color: #909399 }
.ghead .t { font-weight: 600; color: #303133 }
.ghead .d { font-size: 12px; color: #909399 }
.ghead .lk { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; font-size: 12px; color: #606266; white-space: nowrap }
.ghead .lk i { width: 8px; height: 8px; border-radius: 50% }
.row { padding: 3px 4px; border-radius: 6px; font-size: 13px; color: #303133 }
.row:hover { background: #f5f7fa }
.row:focus-visible { outline: 2px solid #2a78d6; outline-offset: 1px }
.date { font-size: 12px; color: #909399; font-variant-numeric: tabular-nums }
.name { display: flex; align-items: center; gap: 8px; min-width: 0 }
.nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.av { width: 28px; height: 28px; border-radius: 6px; background: #f0f2f5; flex: none; object-fit: contain }
.track { position: relative; height: 10px; background: #f0f2f5; border-radius: 0 4px 4px 0 }
.track i { position: absolute; inset: 0 auto 0 0; background: #a3a9b2; border-radius: 0 4px 4px 0 }
.track b { position: absolute; top: -3px; bottom: -3px; border-left: 1px dashed #909399; opacity: 0.7 }
.p { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums }
.res { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0 }
.cross { padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #2a78d6; background: #ecf5ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100% }
.full { padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #c45656; background: #fef0f0; white-space: nowrap }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 1px 9px 1px 7px; border: 1px solid #e4e7ed; border-radius: 999px; font-size: 12px; white-space: nowrap }
.tip { position: fixed; z-index: 3000; pointer-events: none; max-width: 300px; padding: 8px 10px; font-size: 12px; line-height: 1.6; color: #303133; background: #fff; border: 1px solid #e4e7ed; border-radius: 8px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12) }
.tip :deep(.th) { display: flex; gap: 10px; align-items: center; margin-bottom: 4px }
.tip :deep(.th img) { width: 44px; height: 44px; border-radius: 8px; background: #f0f2f5 }
.tip :deep(.m) { color: #909399 }
</style>
