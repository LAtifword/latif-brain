import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../../../core/theme/app_theme.dart';
import '../data/dashboard_api.dart';
import '../models/activity_item.dart';
import '../models/agent_info.dart';
import '../models/system_stats.dart';
import 'widgets/activity_list.dart';
import 'widgets/agent_tile.dart';
import 'widgets/cpu_history_chart.dart';
import 'widgets/metric_ring.dart';
import 'widgets/stat_tile.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.onOpenAgent});

  final void Function(String agentId)? onOpenAgent;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late final DashboardApi _api;

  SystemStats? _stats;
  List<AgentInfo> _agents = [];
  List<ActivityItem> _activity = [];
  Map<String, dynamic>? _summary;
  int _localModelCount = 0;

  final List<double> _cpuHistory = [];
  StreamSubscription<SystemStats>? _statsSub;
  Timer? _fallbackPoll;
  String? _loadError;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final config = context.read<BackendConfig>();
    _api = DashboardApi(ApiClient(config), config);
    _loadAll();
    _subscribeLiveStats();
  }

  @override
  void dispose() {
    _statsSub?.cancel();
    _fallbackPoll?.cancel();
    super.dispose();
  }

  void _subscribeLiveStats() {
    _statsSub = _api.watchStats().listen(
      (stats) => _onStats(stats),
      onError: (_) => _startFallbackPolling(),
    );
  }

  void _startFallbackPolling() {
    _fallbackPoll ??= Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        _onStats(await _api.fetchStats());
      } catch (_) {
        // Backend genuinely unreachable; leave last-known stats on screen.
      }
    });
  }

  void _onStats(SystemStats stats) {
    if (!mounted) return;
    setState(() {
      _stats = stats;
      _cpuHistory.add(stats.cpuPercent);
      if (_cpuHistory.length > 30) _cpuHistory.removeAt(0);
    });
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final results = await Future.wait([
        _api.fetchAgents(),
        _api.fetchActivity(limit: 8),
        _api.fetchSummary(),
        _api.fetchLocalModels(),
      ]);
      if (!mounted) return;
      setState(() {
        _agents = results[0] as List<AgentInfo>;
        _activity = results[1] as List<ActivityItem>;
        _summary = results[2] as Map<String, dynamic>;
        _localModelCount = (results[3] as List).length;
        _loading = false;
      });
      if (_stats == null) {
        _onStats(await _api.fetchStats());
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.message;
        _loading = false;
      });
    }
  }

  String _formatUptime(double seconds) {
    final d = Duration(seconds: seconds.toInt());
    if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes % 60}m';
    if (d.inMinutes > 0) return '${d.inMinutes}m ${d.inSeconds % 60}s';
    return '${d.inSeconds}s';
  }

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) {
      return _BackendUnreachable(message: _loadError!, onRetry: _loadAll);
    }

    return RefreshIndicator(
      onRefresh: _loadAll,
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'AI Agent Command Center',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Orchestrate local agents to build, create, and solve anything.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.5,
                  children: [
                    StatTile(
                      label: 'Agents Online',
                      value: '${_summary?['agents_running'] ?? 0}/${_summary?['agents_total'] ?? 0}',
                      icon: Icons.hub_outlined,
                    ),
                    StatTile(
                      label: 'Local Models',
                      value: '$_localModelCount',
                      icon: Icons.memory_outlined,
                      subtitle: _localModelCount == 0 ? 'None installed' : null,
                    ),
                    StatTile(
                      label: 'Activity Events',
                      value: '${_activity.length}',
                      icon: Icons.timeline_outlined,
                    ),
                    StatTile(
                      label: 'Backend Uptime',
                      value: _stats != null ? _formatUptime(_stats!.uptimeSeconds) : '—',
                      icon: Icons.bolt_outlined,
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Agent Network',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  ],
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.95,
                  children: [
                    for (final agent in _agents)
                      AgentTile(agent: agent, onTap: () => widget.onOpenAgent?.call(agent.id)),
                  ],
                ),
                const SizedBox(height: 24),
                const Text('System Performance',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 12),
                GlassCard(
                  child: SizedBox(height: 160, child: CpuHistoryChart(samples: _cpuHistory)),
                ),
                const SizedBox(height: 12),
                GlassCard(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      MetricRing(label: 'CPU', percent: _stats?.cpuPercent ?? 0),
                      MetricRing(label: 'Memory', percent: _stats?.memoryPercent ?? 0, color: AppColors.warning),
                      MetricRing(label: 'Storage', percent: _stats?.diskPercent ?? 0, color: AppColors.primaryDim),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Text('Recent Activity',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 12),
                GlassCard(child: ActivityList(items: _activity)),
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}

class _BackendUnreachable extends StatelessWidget {
  const _BackendUnreachable({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, color: AppColors.textSecondary, size: 48),
            const SizedBox(height: 16),
            const Text('Backend unreachable',
                style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 20),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
