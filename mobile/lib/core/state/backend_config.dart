import 'package:flutter/foundation.dart';

import '../storage/app_prefs.dart';

enum BackendConnectionState { unknown, connecting, connected, unreachable }

/// Holds the URL of the FastAPI backend AgentOS talks to, plus its live
/// reachability state. The mobile app never assumes the backend is up —
/// every screen reacts to [connectionState] instead of hardcoding "online".
class BackendConfig extends ChangeNotifier {
  BackendConfig(this._prefs) : _baseUrl = _prefs.backendUrl ?? '';

  final AppPrefs _prefs;
  String _baseUrl;
  BackendConnectionState connectionState = BackendConnectionState.unknown;
  String? lastError;

  String get baseUrl => _baseUrl;

  bool get isConfigured => _baseUrl.isNotEmpty;

  Future<void> setBaseUrl(String url) async {
    final normalized = url.trim().replaceAll(RegExp(r'/+$'), '');
    _baseUrl = normalized;
    await _prefs.setBackendUrl(normalized);
    connectionState = BackendConnectionState.unknown;
    notifyListeners();
  }

  String get httpBase => _baseUrl;

  String get wsBase => _baseUrl.replaceFirst(RegExp(r'^http'), 'ws');

  void setConnectionState(BackendConnectionState state, {String? error}) {
    connectionState = state;
    lastError = error;
    notifyListeners();
  }
}
