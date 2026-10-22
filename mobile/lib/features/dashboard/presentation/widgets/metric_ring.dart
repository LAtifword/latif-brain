import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class MetricRing extends StatelessWidget {
  const MetricRing({super.key, required this.label, required this.percent, this.color = AppColors.primary});

  final String label;
  final double percent;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final clamped = percent.clamp(0, 100) / 100;
    return Column(
      children: [
        SizedBox(
          width: 72,
          height: 72,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 72,
                height: 72,
                child: CircularProgressIndicator(
                  value: clamped.toDouble(),
                  strokeWidth: 6,
                  backgroundColor: AppColors.border,
                  valueColor: AlwaysStoppedAnimation(color),
                ),
              ),
              Text(
                '${percent.round()}%',
                style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      ],
    );
  }
}
