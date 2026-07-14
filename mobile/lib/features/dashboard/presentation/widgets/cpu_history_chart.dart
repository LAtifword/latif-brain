import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Renders the rolling CPU-percent history collected client-side from the
/// live WebSocket feed. There is no synthetic data here — the chart is
/// simply empty until enough real samples have arrived.
class CpuHistoryChart extends StatelessWidget {
  const CpuHistoryChart({super.key, required this.samples});

  final List<double> samples;

  @override
  Widget build(BuildContext context) {
    if (samples.length < 2) {
      return const Center(
        child: Text(
          'Collecting live samples…',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
      );
    }

    final spots = [
      for (var i = 0; i < samples.length; i++) FlSpot(i.toDouble(), samples[i]),
    ];

    return LineChart(
      LineChartData(
        minY: 0,
        maxY: 100,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: 25,
          getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.border, strokeWidth: 1),
        ),
        titlesData: const FlTitlesData(
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true, reservedSize: 32, interval: 50),
          ),
        ),
        borderData: FlBorderData(show: false),
        lineTouchData: const LineTouchData(enabled: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: AppColors.primary,
            barWidth: 2,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [AppColors.primary.withOpacity(0.25), AppColors.primary.withOpacity(0.0)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
