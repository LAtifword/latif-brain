import 'package:shared_preferences/shared_preferences.dart';

/// Thin wrapper around SharedPreferences for AgentOS's small set of local
/// settings. The PIN itself is never stored here — only verified against
/// the backend, which holds the hash.
class AppPrefs {
  AppPrefs._(this._prefs);

  static const _keyBackendUrl = 'agentos.backend_url';
  static const _keyOnboarded = 'agentos.onboarded';
  static const _keyPinLockEnabled = 'agentos.pin_lock_enabled';

  final SharedPreferences _prefs;

  static Future<AppPrefs> create() async {
    final prefs = await SharedPreferences.getInstance();
    return AppPrefs._(prefs);
  }

  String? get backendUrl => _prefs.getString(_keyBackendUrl);

  Future<void> setBackendUrl(String url) => _prefs.setString(_keyBackendUrl, url);

  bool get onboarded => _prefs.getBool(_keyOnboarded) ?? false;

  Future<void> setOnboarded(bool value) => _prefs.setBool(_keyOnboarded, value);

  bool get pinLockEnabled => _prefs.getBool(_keyPinLockEnabled) ?? false;

  Future<void> setPinLockEnabled(bool value) => _prefs.setBool(_keyPinLockEnabled, value);
}
