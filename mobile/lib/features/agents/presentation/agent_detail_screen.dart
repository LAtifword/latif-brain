import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/agent_icons.dart';
import '../../dashboard/models/agent_info.dart';
import '../../chat/presentation/chat_screen.dart';

class AgentDetailScreen extends StatelessWidget {
  const AgentDetailScreen({super.key, required this.agent});

  final AgentInfo agent;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(agent.name)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceGlass,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(agentIconFor(agent.icon), color: AppColors.primary, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(agent.name,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      StatusDot(
                        online: agent.status == AgentStatus.online,
                        label: switch (agent.status) {
                          AgentStatus.online => 'Online',
                          AgentStatus.offline => 'Offline — no local model loaded',
                          AgentStatus.notImplemented => 'Planned — not implemented yet',
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(agent.description, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
            const SizedBox(height: 20),
            const Text('Capabilities', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final capability in agent.capabilities)
                  Chip(
                    label: Text(capability.replaceAll('_', ' ')),
                    backgroundColor: AppColors.surfaceGlass,
                    labelStyle: const TextStyle(color: AppColors.primary, fontSize: 12),
                    side: const BorderSide(color: AppColors.border),
                  ),
              ],
            ),
            const SizedBox(height: 28),
            if (agent.implemented)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => Scaffold(
                        appBar: AppBar(title: const Text('Chat Agent')),
                        body: const ChatScreen(),
                      ),
                    ),
                  ),
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  label: const Text('Open Chat Agent'),
                ),
              )
            else
              GlassCard(
                child: Row(
                  children: [
                    const Icon(Icons.construction_rounded, color: AppColors.warning),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'This agent is on the AgentOS roadmap but has no working implementation yet. '
                        'It will run entirely locally once built — see ROADMAP.md.',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
