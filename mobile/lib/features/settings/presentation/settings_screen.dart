import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_client.dart';
import '../../../core/state/backend_config.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _urlController;
  late final ApiClient _client;
  bool _testing = false;
  String? _testResult;
  bool _testOk = false;

  List<dynamic> _models = [];
  bool _loadingModels = true;
  bool _pinConfigured = false;
  bool _pinLockEnabled = false;

  @override
  void initState() {
    super.initState();
    final config = context.read<BackendConfig>();
    _urlController = TextEditingController(text: config.baseUrl);
    _client = ApiClient(config);
    _pinLockEnabled = context.read<AppPrefs>().pinLockEnabled;
    _loadModelsAndAuth();
  }

  Future<void> _loadModelsAndAuth() async {
    setState(() => _loadingModels = true);
    try {
      final models = await _client.get('/api/models');
      final auth = await _client.get('/api/auth/status');
      if (!mounted) return;
      setState(() {
        _models = models as List<dynamic>;
        _pinConfigured = (auth as Map<String, dynamic>)['pin_configured'] as bool;
        _loadingModels = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingModels = false);
    }
  }

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _testResult = null;
    });
    final config = context.read<BackendConfig>();
    await config.setBaseUrl(_urlController.text);
    try {
      await _client.get('/api/system/health');
      if (!mounted) return;
      config.setConnectionState(BackendConnectionState.connected);
      setState(() {
        _testOk = true;
        _testResult = 'Connected.';
        _testing = false;
      });
      _loadModelsAndAuth();
    } on ApiException catch (e) {
      if (!mounted) return;
      config.setConnectionState(BackendConnectionState.unreachable, error: e.message);
      setState(() {
        _testOk = false;
        _testResult = e.message;
        _testing = false;
      });
    }
  }

  Future<void> _setPin() async {
    final controller = TextEditingController();
    final pin = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Set local PIN', style: TextStyle(color: AppColors.textPrimary)),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 12,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: const InputDecoration(hintText: '4-12 digits'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (pin == null || pin.length < 4) return;
    try {
      await _client.post('/api/auth/pin', body: {'pin': pin});
      if (!mounted) return;
      setState(() => _pinConfigured = true);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN saved.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  String _formatBytes(int bytes) {
    if (bytes > 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Backend Connection', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 8),
        Text(
          'AgentOS talks to a FastAPI backend running the local model engine. '
          'Point this at wherever that backend is reachable (same device via a '
          'terminal app, or another machine on your network).',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 12),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _urlController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Backend URL',
                  hintText: 'http://192.168.1.20:8765',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  ElevatedButton(
                    onPressed: _testing ? null : _testConnection,
                    child: _testing
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                        : const Text('Save & Test'),
                  ),
                  const SizedBox(width: 12),
                  if (_testResult != null)
                    Expanded(
                      child: Text(
                        _testResult!,
                        style: TextStyle(color: _testOk ? AppColors.primary : AppColors.danger, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text('Local Models', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 8),
        const Text(
          'GGUF model files placed in the backend\'s data/models directory. '
          'The Chat Agent auto-loads the first one found.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 12),
        if (_loadingModels)
          const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppColors.primary)))
        else if (_models.isEmpty)
          const GlassCard(
            child: Text('No GGUF models found on the backend yet.', style: TextStyle(color: AppColors.textSecondary)),
          )
        else
          GlassCard(
            child: Column(
              children: [
                for (final model in _models)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(model['filename'] as String, style: const TextStyle(color: AppColors.textPrimary)),
                        ),
                        Text(_formatBytes(model['size_bytes'] as int),
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(width: 8),
                        if (model['is_loaded'] == true) const StatusDot(online: true, label: 'Loaded'),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 24),
        const Text('Security', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 12),
        GlassCard(
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.primary,
                title: const Text('Require PIN on launch', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: Text(
                  _pinConfigured ? 'PIN is configured on the backend.' : 'No PIN configured yet.',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                value: _pinLockEnabled && _pinConfigured,
                onChanged: _pinConfigured
                    ? (value) async {
                        await context.read<AppPrefs>().setPinLockEnabled(value);
                        setState(() => _pinLockEnabled = value);
                      }
                    : null,
              ),
              const Divider(height: 1),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(onPressed: _setPin, child: Text(_pinConfigured ? 'Change PIN' : 'Set PIN')),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}
