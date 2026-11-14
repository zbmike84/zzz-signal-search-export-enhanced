<template>
  <section class="panel">
    <h2>{{ text.version.title }}</h2>
    <p class="sub">{{ text.version.hint }}</p>
    <div ref="chart" class="chart"></div>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { use, init } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import throttle from 'lodash-es/throttle'
import { fmt, COLORS, esc } from '../analysisUi'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({ analysis: Object, typeMap: Map, text: Object, icons: Object })
const chart = ref(null)
let ec = null

function render() {
  if (!ec) return
  const V = props.analysis.versions, t = props.text.version
  ec.setOption({
    animation: false,
    grid: { left: 48, right: 12, top: 34, bottom: 26 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, enterable: false, confine: true,
      formatter: ps => {
        const v = V[ps[0].dataIndex]
        let h = `<b>${esc(fmt(t.tip, { v: v.version, n: v.total.toLocaleString() }))}</b>`
        for (const k of ['2', '3', '102', '103', '5', '1']) {
          if (v.pools[k]) h += `<br>${esc(props.typeMap.get(k) || k)}: ${v.pools[k].toLocaleString()}`
        }
        if (v.fives.length) {
          h += `<br><span style="color:#909399">${esc(fmt(t.fives, { n: v.fives.length }))}</span><div style="display:flex;flex-wrap:wrap;gap:4px;max-width:260px;margin-top:4px">`
          h += v.fives.map(f => props.icons[f.itemId]
            ? `<img src="${props.icons[f.itemId]}" title="${esc(f.name)}" style="width:30px;height:30px;border-radius:6px;background:#f0f2f5">`
            : `<span>${esc(f.name)}</span>`).join('')
          h += '</div>'
        }
        return h
      },
    },
    xAxis: { type: 'category', data: V.map(v => v.version), axisTick: { show: false },
      axisLine: { lineStyle: { color: '#c0c4cc' } }, axisLabel: { color: '#909399' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#ebeef5' } }, axisLabel: { color: '#909399' } },
    series: [{
      type: 'bar', data: V.map(v => v.total), barCategoryGap: '20%',
      itemStyle: { color: COLORS.bar, borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: '#303133' } },
    }],
  }, true)
}
const resize = throttle(() => ec?.resize(), 100)
onMounted(() => { ec = init(chart.value); render(); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); ec?.dispose() })
watch([() => props.analysis, () => props.icons, () => props.text], render)
</script>

<style scoped>
.panel { padding: 16px 18px; border: 1px solid #e4e7ed; border-radius: 8px; background: #fff }
h2 { margin: 0; font-size: 16px; font-weight: 600; color: #303133 }
.sub { margin: 2px 0 0; font-size: 12px; color: #909399 }
.chart { height: 260px; margin-top: 8px }
</style>
