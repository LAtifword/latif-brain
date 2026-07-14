import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/agent_icons.dart';
import '../../models/activity_item.dart';

String _relativeTime(DateTime time) {
  final diff = DateTime.now().toUtc().difference(time.toUtc());
  if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}

class ActivityList extends StatelessWidget {
  const ActivityList({super.key, required this.items});

  final List<ActivityItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text('No activity yet.', style: TextStyle(color: AppColors.textSecondary)),
        ),
      );
    }

    return Column(
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceGlass,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(agentIconFor(item.agentId), size: 16, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.action,
                        style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                      ),
                      if (item.detail.isNotEmpty)
                        Text(
                          item.detail,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                    ],
                  ),
                ),
                Text(_relativeTime(item.createdAt), style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ],
            ),
          ),
      ],
    );
  }
}
