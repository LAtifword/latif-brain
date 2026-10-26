import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../models/activity_item.dart';
import '../models/agent_info.dart';
import '../models/system_stats.dart';

class DashboardApi {
  DashboardApi(this._client, this._config);

  final ApiClient _client;
  final BackendConfig _config;

  Future<SystemStats> fetchStats() async {
    final json = await _client.get('/api/system/stats');
    return SystemStats.fromJson(json as Map<String, dynamic>);
  }

  Future<List<AgentInfo>> fetchAgents() async {
    final json = await _client.get('/api/agents');
    return (json as List).map((e) => AgentInfo.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ActivityItem>> fetchActivity({int limit = 20}) async {
    final json = await _client.get('/api/activity', query: {'limit': limit});
    return (json as List).map((e) => ActivityItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> fetchSummary() async {
    final json = await _client.get('/api/system/summary');
    return json as Map<String, dynamic>;
  }

  Future<List<dynamic>> fetchLocalModels() async {
    final json = await _client.get('/api/models');
    return json as List<dynamic>;
  }

  /// Live-updating stream of [SystemStats] pushed by the backend over
  /// WebSocket. Emits nothing (and lets the caller fall back to polling) if
  /// the socket cannot be opened.
  Stream<SystemStats> watchStats() {
    final controller = StreamController<SystemStats>();
    WebSocketChannel? channel;

    try {
      channel = WebSocketChannel.connect(Uri.parse('${_config.wsBase}/api/system/ws'));
    } catch (e) {
      controller.addError(e);
      controller.close();
      return controller.stream;
    }

    final sub = channel.stream.listen(
      (raw) {
        try {
          final json = jsonDecode(raw as String) as Map<String, dynamic>;
          controller.add(SystemStats.fromJson(json));
        } catch (e) {
          // Ignore malformed frames rather than killing the stream.
        }
      },
      onError: controller.addError,
      onDone: controller.close,
    );

    controller.onCancel = () {
      sub.cancel();
      channel?.sink.close();
    };

    return controller.stream;
  }
}
