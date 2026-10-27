import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/agent_icons.dart';
import '../../models/agent_info.dart';

class AgentTile extends StatelessWidget {
  const AgentTile({super.key, required this.agent, this.onTap});

  final AgentInfo agent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final online = agent.status == AgentStatus.online;
    final notImplemented = agent.status == AgentStatus.notImplemented;

    return GlassCard(
      onTap: onTap,
      glowColor: online ? AppColors.primary : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surfaceGlass,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(agentIconFor(agent.icon), color: AppColors.primary, size: 20),
          ),
          const SizedBox(height: 10),
          Text(
            agent.name,
            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 2),
          Text(
            agent.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 10),
          StatusDot(
            online: online,
            label: online ? 'Online' : (notImplemented ? 'Planned' : 'Offline'),
          ),
        ],
      ),
    );
  }
}
