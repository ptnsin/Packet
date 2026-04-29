import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

export function usePacketChart(canvasRef) {
  const chartRef = useRef(null)

  useEffect(() => {
    const now = Date.now()
    const labels = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now - (11 - i) * 5000)
      return String(d.getHours()).padStart(2, '0') + ':' +
       String(d.getMinutes()).padStart(2, '0') + ':' +
       String(d.getSeconds()).padStart(2, '0')
    })
    const encData = Array.from({ length: 12 }, () => 0)
    const plainData = Array.from({ length: 12 }, () => 0)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Encrypted',
            data: encData,
            borderColor: '#00d2a8',
            backgroundColor: 'rgba(0,210,168,.08)',
            borderWidth: 1.5,
            pointRadius: 2,
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Plain',
            data: plainData,
            borderColor: '#e3b341',
            backgroundColor: 'rgba(227,179,65,.06)',
            borderWidth: 1.5,
            pointRadius: 2,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: '#7d8590',
              font: { family: 'JetBrains Mono', size: 11 },
              boxWidth: 12,
              padding: 16,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 10 } },
            grid: { color: 'rgba(48,54,61,.5)' },
          },
          y: {
            ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 10 } },
            grid: { color: 'rgba(48,54,61,.5)' },
            beginAtZero: true,
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
    }
  }, [canvasRef])

  function pushPoint(isEncrypted) {
    const chart = chartRef.current
    if (!chart) return
    const d = new Date()
    const label = String(d.getHours()).padStart(2, '0') + ':' +
              String(d.getMinutes()).padStart(2, '0') + ':' +
              String(d.getSeconds()).padStart(2, '0')
    chart.data.labels.push(label)
    chart.data.labels.shift()
    chart.data.datasets[0].data.push(isEncrypted ? 1 : 0)
    chart.data.datasets[0].data.shift()
    chart.data.datasets[1].data.push(isEncrypted ? 0 : 1)
    chart.data.datasets[1].data.shift()
    chart.update('none')
  }

  return { pushPoint }
}
