import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../dashboard/data/dashboard_api.dart';
import '../../dashboard/models/agent_info.dart';
import 'agent_detail_screen.dart';

class AgentsScreen extends StatefulWidget {
  const AgentsScreen({super.key});

  @override
  State<AgentsScreen> createState() => _AgentsScreenState();
}

class _AgentsScreenState extends State<AgentsScreen> {
  late final DashboardApi _api;
  List<AgentInfo> _agents = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final config = context.read<BackendConfig>();
    _api = DashboardApi(ApiClient(config), config);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final agents = await _api.fetchAgents();
      if (!mounted) return;
      setState(() {
        _agents = agents;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: const TextStyle(color: AppColors.textSecondary), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _agents.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          final agent = _agents[i];
          return GlassCard(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => AgentDetailScreen(agent: agent)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(agent.name,
                          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                      const SizedBox(height: 4),
                      Text(agent.description, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      const SizedBox(height: 8),
                      StatusDot(
                        online: agent.status == AgentStatus.online,
                        label: switch (agent.status) {
                          AgentStatus.online => 'Online',
                          AgentStatus.offline => 'Offline — no model loaded',
                          AgentStatus.notImplemented => 'Planned, not implemented yet',
                        },
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
              ],
            ),
          );
        },
      ),
    );
  }
}
